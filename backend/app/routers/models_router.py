"""
Model Registry endpoints:
  GET  /api/models                     — list all model versions
  GET  /api/models/{model_name}        — list versions for one model
  POST /api/models/{model_id}/promote  — promote to production
  GET  /api/models/{model_id}/download — download best.pt from GCS
  GET  /api/models/status              — check which model is in production
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.model_version import ModelVersion
from app.services import gcs_client

logger = logging.getLogger(__name__)

router = APIRouter()


class RegisterVersionRequest(BaseModel):
    job_id: int
    model_name: str
    version: int
    gcs_path: str
    map50: float = None
    precision: float = None
    recall: float = None
    speed_ms: float = None


# ── List ───────────────────────────────────────────────────────────────────────

@router.get("")
def list_all_versions(db: Session = Depends(get_db)):
    versions = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
    return [_mv_to_dict(v) for v in versions]


@router.get("/{model_name}")
def list_versions_by_name(model_name: str, db: Session = Depends(get_db)):
    versions = (
        db.query(ModelVersion)
        .filter(ModelVersion.model_name == model_name)
        .order_by(ModelVersion.version.desc())
        .all()
    )
    if not versions:
        raise HTTPException(404, f"No versions found for model '{model_name}'.")
    return [_mv_to_dict(v) for v in versions]


# ── Register (called by VM2 after training) ────────────────────────────────────

@router.post("", status_code=201)
def register_version(body: RegisterVersionRequest, db: Session = Depends(get_db)):
    mv = ModelVersion(
        job_id=body.job_id,
        model_name=body.model_name,
        version=body.version,
        gcs_path=body.gcs_path,
        map50=body.map50,
        precision=body.precision,
        recall=body.recall,
        speed_ms=body.speed_ms,
        is_production=False,
    )
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return _mv_to_dict(mv)


# ── Promote ────────────────────────────────────────────────────────────────────

@router.post("/{model_id}/promote")
def promote_to_production(model_id: int, db: Session = Depends(get_db)):
    mv = db.query(ModelVersion).filter(ModelVersion.id == model_id).first()
    if not mv:
        raise HTTPException(404, "Model version not found.")

    # Demote all other versions of the same model name
    db.query(ModelVersion).filter(
        ModelVersion.model_name == mv.model_name,
        ModelVersion.id != model_id,
    ).update({"is_production": False})

    mv.is_production = True
    db.commit()

    # Update production.json in GCS atomically
    try:
        gcs_client.write_production_pointer(
            mv.model_name,
            {
                "model_name": mv.model_name,
                "version": mv.version,
                "gcs_path": mv.gcs_path,
                "promoted_at": datetime.utcnow().isoformat(),
            },
        )
    except Exception as exc:
        logger.error("Failed to write production.json: %s", exc)

    db.refresh(mv)
    return _mv_to_dict(mv)


# ── Download ───────────────────────────────────────────────────────────────────

@router.get("/{model_id}/download")
def download_model(model_id: int, db: Session = Depends(get_db)):
    """Stream best.pt directly from GCS to the browser."""
    mv = db.query(ModelVersion).filter(ModelVersion.id == model_id).first()
    if not mv:
        raise HTTPException(404, "Model version not found.")

    from google.cloud import storage
    from app.config import settings

    blob_path = mv.gcs_path.rstrip("/") + "/best.pt"
    try:
        client = storage.Client()
        bucket = client.bucket(settings.GCS_BUCKET)
        blob = bucket.blob(blob_path)
        if not blob.exists():
            raise HTTPException(404, f"best.pt not found in GCS at {blob_path}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("GCS error checking %s: %s", blob_path, exc)
        raise HTTPException(500, "Could not access model file in GCS.")

    filename = f"{mv.model_name}_v{mv.version}_best.pt"

    def _stream():
        with blob.open("rb") as f:
            while chunk := f.read(1024 * 1024):  # 1 MB chunks
                yield chunk

    return StreamingResponse(
        _stream(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _mv_to_dict(mv: ModelVersion) -> dict:
    return {
        "id": mv.id,
        "job_id": mv.job_id,
        "model_name": mv.model_name,
        "version": mv.version,
        "gcs_path": mv.gcs_path,
        "map50": mv.map50,
        "precision": mv.precision,
        "recall": mv.recall,
        "speed_ms": mv.speed_ms,
        "is_production": mv.is_production,
        "created_at": mv.created_at.isoformat() if mv.created_at else None,
    }
