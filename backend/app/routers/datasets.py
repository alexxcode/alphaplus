"""
Dataset endpoints:
  GET  /api/datasets/mentat          — list MENTAT datasets (DB-registered + GCS scan)
  POST /api/datasets/mentat/register — MENTAT notifies backend after GCS upload → creates DB record
  GET  /api/datasets/manual          — list manual datasets from DB
  POST /api/datasets/upload/init     — start a resumable GCS upload session
  POST /api/datasets/upload/complete — notify backend that upload is done → enqueue extraction
  GET  /api/datasets/{id}/status     — poll extraction progress
  DELETE /api/datasets/{id}          — cancel / soft-delete
"""
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.dataset import Dataset
from app.services import gcs_client

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class UploadInitRequest(BaseModel):
    filename: str
    file_size_bytes: int
    project_name: str


class UploadCompleteRequest(BaseModel):
    dataset_id: int
    upload_id: str


class GDriveImportRequest(BaseModel):
    gdrive_file_id: str
    project_name: str


class MentatRegisterRequest(BaseModel):
    """
    Payload sent by MENTAT after it finishes uploading a dataset to GCS.

    Required
    --------
    gcs_path      : GCS prefix where the dataset lives, e.g.
                    "datasets/myproject/20240427T120000/"
                    (trailing slash is normalised automatically)
    project_name  : Human-readable project / label-session name.

    Optional (enriches the DB record; inferred from GCS metadata.json if omitted)
    --------
    class_names   : List of class label strings, e.g. ["car", "person"].
    image_count   : Total number of labelled images.
    class_count   : Number of distinct classes (defaults to len(class_names)).
    """
    gcs_path: str
    project_name: str
    class_names: list[str] = None
    image_count: int = None
    class_count: int = None


# ── MENTAT datasets ────────────────────────────────────────────────────────────

@router.get("/mentat")
def list_mentat_datasets(db: Session = Depends(get_db)):
    """
    List MENTAT datasets.

    Merges two sources so the UI always sees the full picture:
      1. Datasets registered via POST /mentat/register (have a DB id → usable in jobs)
      2. Datasets discovered directly from GCS (legacy / not yet registered)

    DB records take precedence when both share the same gcs_path.
    """
    # --- source 1: DB-registered MENTAT datasets (have an id) ---
    db_rows = (
        db.query(Dataset)
        .filter(Dataset.source == "mentat")
        .order_by(Dataset.upload_date.desc())
        .all()
    )
    registered_by_path = {ds.gcs_path: _dataset_to_dict(ds) for ds in db_rows}

    # --- source 2: GCS scan (may include datasets not yet in DB) ---
    gcs_datasets = gcs_client.list_mentat_datasets()

    merged: list[dict] = list(registered_by_path.values())
    seen_paths = set(registered_by_path.keys())

    for gcs_ds in gcs_datasets:
        path = gcs_ds.get("gcs_path")
        if path not in seen_paths:
            # Not in DB yet — surface it without an id so the UI can prompt the user
            merged.append({**gcs_ds, "id": None})
            seen_paths.add(path)

    return merged


@router.post("/mentat/register", status_code=201)
def register_mentat_dataset(body: MentatRegisterRequest, db: Session = Depends(get_db)):
    """
    Called by MENTAT after it finishes uploading a dataset to GCS.

    Creates (or returns the existing) DB record so the dataset becomes
    immediately available as a dataset_id for training jobs.

    MENTAT should call this endpoint once the GCS upload is complete.
    The backend validates that the GCS path is reachable before persisting.
    """
    # Normalise trailing slash
    gcs_path = body.gcs_path.rstrip("/") + "/"

    # Idempotency: return existing record if already registered
    existing = db.query(Dataset).filter(
        Dataset.source == "mentat",
        Dataset.gcs_path == gcs_path,
    ).first()
    if existing:
        return _dataset_to_dict(existing)

    # Validate that the GCS path is reachable (data.yaml must exist)
    data_yaml_path = f"{gcs_path}data.yaml"
    try:
        reachable = gcs_client.blob_exists(data_yaml_path)
    except Exception as exc:
        raise HTTPException(503, f"Could not reach GCS to verify dataset: {exc}")
    if not reachable:
        raise HTTPException(
            404,
            f"data.yaml not found at gs://{data_yaml_path}. "
            "Ensure the dataset was fully uploaded before registering.",
        )

    # Try to enrich metadata from GCS metadata.json if caller didn't provide it
    class_names = body.class_names
    image_count = body.image_count
    class_count = body.class_count

    if class_names is None or image_count is None:
        try:
            from app.services.gcs_client import _get_client
            bucket = _get_client().bucket(__import__("app.config", fromlist=["settings"]).settings.GCS_BUCKET)
            blob = bucket.blob(f"{gcs_path}metadata.json")
            if blob.exists():
                import json as _json
                meta = _json.loads(blob.download_as_text())
                class_names  = class_names  or meta.get("class_names")
                image_count  = image_count  or meta.get("image_count")
                class_count  = class_count  or meta.get("class_count")
        except Exception:
            pass  # metadata.json is optional — proceed with whatever the caller provided

    if class_count is None and class_names is not None:
        class_count = len(class_names)

    ds = Dataset(
        source="mentat",
        status="ready",
        gcs_path=gcs_path,
        project_name=body.project_name,
        class_names=class_names,
        image_count=image_count,
        class_count=class_count,
        progress_message="Registered via MENTAT webhook.",
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    return _dataset_to_dict(ds)


# ── Manual datasets ────────────────────────────────────────────────────────────

@router.get("/manual")
def list_manual_datasets(db: Session = Depends(get_db)):
    """List all manually uploaded datasets (all statuses)."""
    rows = (
        db.query(Dataset)
        .filter(Dataset.source == "manual")
        .order_by(Dataset.upload_date.desc())
        .all()
    )
    return [_dataset_to_dict(d) for d in rows]


# ── Upload flow ────────────────────────────────────────────────────────────────

@router.post("/upload/init")
def init_upload(body: UploadInitRequest, db: Session = Depends(get_db)):
    """
    Step 1: Create GCS resumable upload session.
    Returns a signed session URI for the browser to PUT directly to GCS.
    """
    # Validate
    if not body.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Only .zip files are accepted.")
    if body.file_size_bytes < 1_024:  # 1 KB mínimo absoluto
        raise HTTPException(400, "File too small.")
    if body.file_size_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(400, f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE_BYTES // 1_073_741_824} GB.")

    upload_id = str(uuid.uuid4())

    # Create GCS resumable session
    try:
        session_uri = gcs_client.create_resumable_upload_session(
            upload_uuid=upload_id,
            file_size=body.file_size_bytes,
            origin=settings.FRONTEND_ORIGIN,
        )
    except Exception as exc:
        raise HTTPException(503, f"Could not create upload session: {exc}")

    # Persist DB record
    ds = Dataset(
        source="manual",
        status="pending_upload",
        upload_id=upload_id,
        original_filename=body.filename,
        file_size_bytes=body.file_size_bytes,
        project_name=body.project_name,
        progress_message="Waiting for upload…",
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    return {
        "dataset_id": ds.id,
        "upload_id": upload_id,
        "gcs_resumable_url": session_uri,
        "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
    }


@router.post("/upload/complete")
def complete_upload(body: UploadCompleteRequest, db: Session = Depends(get_db)):
    """
    Step 2: Called by browser after XHR upload finishes.
    Verifies GCS object exists, then enqueues the extraction Celery task.
    """
    ds = db.query(Dataset).filter(Dataset.id == body.dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found.")
    if ds.upload_id != body.upload_id:
        raise HTTPException(400, "upload_id mismatch.")
    if ds.status != "pending_upload":
        raise HTTPException(409, f"Dataset already in status '{ds.status}'.")

    # Verify the ZIP actually landed in GCS
    try:
        if not gcs_client.temp_upload_exists(body.upload_id):
            raise HTTPException(404, "Upload not found in storage. Please retry.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, f"Could not verify upload: {exc}")

    # Enqueue extraction
    from app.tasks.dataset_extraction import extract_dataset_zip
    task = extract_dataset_zip.delay(ds.id, ds.upload_id)

    ds.status = "extracting"
    ds.progress_message = "Queued for extraction…"
    ds.celery_task_id = task.id
    db.commit()

    return {"dataset_id": ds.id, "status": "extracting"}


# ── Google Drive import ────────────────────────────────────────────────────

@router.get("/gdrive")
def list_gdrive_datasets(db: Session = Depends(get_db)):
    """List all Google Drive-imported datasets."""
    rows = (
        db.query(Dataset)
        .filter(Dataset.source == "gdrive")
        .order_by(Dataset.upload_date.desc())
        .all()
    )
    return [_dataset_to_dict(d) for d in rows]


@router.post("/gdrive/import")
def import_from_gdrive(body: GDriveImportRequest, db: Session = Depends(get_db)):
    """
    Import a dataset ZIP from Google Drive.
    Requires the file_id of a .zip file accessible to the service account.
    """
    from app.services import gdrive_client

    # Validate the file exists and is a ZIP
    meta = gdrive_client.get_file_metadata(body.gdrive_file_id)
    if not meta:
        raise HTTPException(404, "Could not access file in Google Drive. Ensure it's shared with the service account.")
    if not meta["name"].lower().endswith(".zip"):
        raise HTTPException(400, "Only .zip files are accepted.")

    # Create DB record
    ds = Dataset(
        source="gdrive",
        status="importing",
        original_filename=meta["name"],
        file_size_bytes=meta["size"],
        project_name=body.project_name,
        gdrive_file_id=body.gdrive_file_id,
        progress_message="Queued for import from Google Drive...",
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    # Enqueue import task
    from app.tasks.gdrive_import import import_from_gdrive as import_task
    task = import_task.delay(ds.id, body.gdrive_file_id)

    ds.celery_task_id = task.id
    db.commit()

    return {"dataset_id": ds.id, "status": "importing", "filename": meta["name"]}


@router.post("/gdrive/browse")
def browse_gdrive_folder(folder_id: str = "root"):
    """List ZIP files in a Google Drive folder (for file picker)."""
    from app.services import gdrive_client

    try:
        files = gdrive_client.list_folder_files(folder_id)
        # Filter to show only ZIPs and subfolders
        result = [
            f for f in files
            if f["name"].lower().endswith(".zip")
            or f["mime_type"] == "application/vnd.google-apps.folder"
        ]
        return result
    except Exception as exc:
        raise HTTPException(503, f"Could not browse Google Drive: {exc}")


# ── Status polling ─────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/status")
def get_dataset_status(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found.")
    return _dataset_to_dict(ds)


# ── Cancel / soft-delete ───────────────────────────────────────────────────────

@router.delete("/{dataset_id}")
def cancel_upload(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found.")

    if ds.upload_id:
        try:
            gcs_client.delete_temp_zip(ds.upload_id)
        except Exception:
            pass

    ds.status = "failed"
    ds.error_message = "Cancelled by user."
    db.commit()
    return {"ok": True}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _dataset_to_dict(ds: Dataset) -> dict:
    return {
        "id": ds.id,
        "gcs_path": ds.gcs_path,
        "class_count": ds.class_count,
        "image_count": ds.image_count,
        "class_names": ds.class_names,
        "upload_date": ds.upload_date.isoformat() if ds.upload_date else None,
        "project_name": ds.project_name,
        "source": ds.source,
        "status": ds.status,
        "progress_message": ds.progress_message,
        "error_message": ds.error_message,
        "upload_id": ds.upload_id,
        "original_filename": ds.original_filename,
        "file_size_bytes": ds.file_size_bytes,
        "gdrive_file_id": ds.gdrive_file_id,
    }
