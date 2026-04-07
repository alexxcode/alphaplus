"""
GCS client — abstraction layer for all Google Cloud Storage operations.
All paths follow the bucket structure defined in ALPHA_PLUS_README.md.
"""
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)


def _get_client():
    try:
        from google.cloud import storage  # noqa: F401
    except ImportError:
        raise HTTPException(503, "google-cloud-storage not installed")

    from google.cloud import storage
    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        return storage.Client.from_service_account_json(
            settings.GOOGLE_APPLICATION_CREDENTIALS,
            project=settings.GCS_PROJECT,
        )
    return storage.Client(project=settings.GCS_PROJECT)


def get_bucket():
    if not settings.GCS_BUCKET:
        raise HTTPException(503, "GCS_BUCKET not configured")
    return _get_client().bucket(settings.GCS_BUCKET)


# ── Dataset listing ────────────────────────────────────────────────────────────

def list_mentat_datasets() -> list[dict]:
    """List all datasets exported by MENTAT (datasets/{project}/{timestamp}/)."""
    try:
        bucket = get_bucket()
        datasets: list[dict] = []

        iterator = bucket.list_blobs(prefix="datasets/", delimiter="/")
        for page in iterator.pages:
            for project_prefix in page.prefixes:
                # project_prefix = "datasets/project_name/"
                parts = project_prefix.rstrip("/").split("/")
                project_name = parts[-1]
                if project_name == "manual":
                    continue
                datasets.extend(_list_project_timestamps(bucket, project_name, project_prefix))
        return datasets
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error listing MENTAT datasets: %s", exc)
        return []


def _list_project_timestamps(bucket, project_name: str, project_prefix: str) -> list[dict]:
    datasets: list[dict] = []
    iterator = bucket.list_blobs(prefix=project_prefix, delimiter="/")
    for page in iterator.pages:
        for ts_prefix in page.prefixes:
            timestamp = ts_prefix.rstrip("/").split("/")[-1]
            meta = _read_metadata(bucket, f"{ts_prefix}metadata.json") or {}
            datasets.append(
                {
                    "gcs_path": ts_prefix,
                    "project_name": project_name,
                    "timestamp": timestamp,
                    "source": "mentat",
                    "status": "ready",
                    **meta,
                }
            )
    return datasets


def _read_metadata(bucket, path: str) -> Optional[dict]:
    try:
        blob = bucket.blob(path)
        if not blob.exists():
            return None
        return json.loads(blob.download_as_text())
    except Exception as exc:
        logger.warning("Could not read metadata at %s: %s", path, exc)
        return None


# ── Resumable upload sessions (manual dataset upload) ─────────────────────────

def create_resumable_upload_session(upload_uuid: str, file_size: int, origin: str) -> str:
    """
    Creates a GCS resumable upload session for direct browser → GCS upload.
    Returns the session URI. The browser uses PUT to this URI with Content-Range headers.
    """
    bucket = get_bucket()
    blob = bucket.blob(f"temp-uploads/{upload_uuid}/upload.zip")
    session_uri = blob.create_resumable_upload_session(
        content_type="application/zip",
        origin=origin,
    )
    return session_uri


def blob_exists(gcs_path: str) -> bool:
    """Return True if a blob exists at the given path in the bucket."""
    bucket = get_bucket()
    return bucket.blob(gcs_path).exists()


def temp_upload_exists(upload_uuid: str) -> bool:
    bucket = get_bucket()
    return bucket.blob(f"temp-uploads/{upload_uuid}/upload.zip").exists()


def get_temp_upload_blob_size(upload_uuid: str) -> int:
    bucket = get_bucket()
    blob = bucket.blob(f"temp-uploads/{upload_uuid}/upload.zip")
    blob.reload()
    return blob.size or 0


def delete_temp_zip(upload_uuid: str) -> None:
    try:
        bucket = get_bucket()
        bucket.blob(f"temp-uploads/{upload_uuid}/upload.zip").delete()
        logger.info("Deleted temp ZIP for upload %s", upload_uuid)
    except Exception as exc:
        logger.warning("Could not delete temp ZIP for %s: %s", upload_uuid, exc)


# ── File operations ────────────────────────────────────────────────────────────

def download_temp_zip(upload_uuid: str, local_path: str) -> None:
    """Download the temp ZIP to local disk for extraction."""
    bucket = get_bucket()
    blob = bucket.blob(f"temp-uploads/{upload_uuid}/upload.zip")
    blob.download_to_filename(local_path)
    logger.info("Downloaded temp ZIP %s to %s", upload_uuid, local_path)


def upload_file(local_path: str, gcs_path: str) -> None:
    bucket = get_bucket()
    bucket.blob(gcs_path).upload_from_filename(local_path)


def upload_text(content: str, gcs_path: str, content_type: str = "application/json") -> None:
    bucket = get_bucket()
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(content, content_type=content_type)


def upload_directory(local_dir: str, gcs_prefix: str, max_workers: int = 16) -> None:
    """Upload all files in local_dir to GCS prefix, parallelised."""
    root = Path(local_dir)
    tasks = [
        (str(f), f"{gcs_prefix}/{f.relative_to(root).as_posix()}")
        for f in root.rglob("*")
        if f.is_file()
    ]

    def _upload(args):
        upload_file(*args)

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = [ex.submit(_upload, t) for t in tasks]
        for fut in as_completed(futures):
            fut.result()  # re-raise any exception
    logger.info("Uploaded %d files to gs://%s/%s", len(tasks), settings.GCS_BUCKET, gcs_prefix)


# ── Model registry ─────────────────────────────────────────────────────────────

def get_model_versions(model_name: str) -> list[dict]:
    try:
        bucket = get_bucket()
        versions: list[dict] = []
        iterator = bucket.list_blobs(prefix=f"models/{model_name}/", delimiter="/")
        for page in iterator.pages:
            for ver_prefix in page.prefixes:
                version_str = ver_prefix.rstrip("/").split("/")[-1]
                meta = _read_metadata(bucket, f"{ver_prefix}metrics.json") or {}
                versions.append({"version": version_str, "gcs_path": ver_prefix, **meta})
        return versions
    except Exception as exc:
        logger.error("Error listing model versions for %s: %s", model_name, exc)
        return []


def read_production_pointer(model_name: str) -> Optional[dict]:
    bucket = get_bucket()
    return _read_metadata(bucket, f"models/{model_name}/production.json")


def write_production_pointer(model_name: str, data: dict) -> None:
    """
    Atomic write of production.json using GCS generation preconditions.
    Avoids partial reads during concurrent access.
    """
    import json as _json
    from google.api_core.exceptions import PreconditionFailed

    bucket = get_bucket()
    blob = bucket.blob(f"models/{model_name}/production.json")
    content = _json.dumps(data, indent=2)

    try:
        blob.reload()
        current_gen = blob.generation
        blob.upload_from_string(
            content,
            content_type="application/json",
            if_generation_match=current_gen,
        )
    except PreconditionFailed:
        # Another writer beat us — overwrite unconditionally (safe for this use-case)
        blob.upload_from_string(content, content_type="application/json")
    except Exception:
        # Blob doesn't exist yet
        blob.upload_from_string(content, content_type="application/json")
