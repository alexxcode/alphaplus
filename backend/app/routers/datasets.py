"""
Dataset endpoints:
  GET  /api/datasets/mentat          — list MENTAT datasets from GCS
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


# ── MENTAT datasets ────────────────────────────────────────────────────────────

@router.get("/mentat")
def list_mentat_datasets():
    """List all MENTAT-exported datasets available in GCS."""
    return gcs_client.list_mentat_datasets()


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
