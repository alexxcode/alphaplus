"""
Public discovery endpoint consumed by MENTAT (and any other service)
to auto-configure the integration without hardcoding values.

  GET /api/config  →  bucket name, datasets prefix, register URL
"""
from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("")
def get_public_config():
    """
    Returns the AlphaPlus integration config that external services need.

    MENTAT calls this once at startup (or on demand) to know:
      - which GCS bucket to export datasets into
      - which GCS prefix to use  (always "datasets/mentat/")
      - which endpoint to POST after the upload is done
    """
    return {
        "gcs_bucket":         settings.GCS_BUCKET,
        "datasets_prefix":    "datasets/",          # MENTAT must upload under datasets/{project}/{timestamp}/
        "register_endpoint":  "/api/datasets/mentat/register",
        "api_version":        "1.0",
    }
