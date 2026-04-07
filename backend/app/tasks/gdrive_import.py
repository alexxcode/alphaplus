"""
Celery task — import a YOLO dataset ZIP from Google Drive.

Flow:
  1. Download ZIP from Google Drive to local scratch disk
  2. Delegate to the existing extraction pipeline (same as manual upload)
"""
import logging
import os
import shutil
import uuid
from pathlib import Path

from celery import Task

from app.config import settings
from app.database import SessionLocal
from app.tasks.celery_app import celery_app
from app.tasks.dataset_extraction import (
    ValidationError,
    _set_status,
    _detect_prefix,
    _detect_layout,
    _validate_structure,
    _restructure_nested,
    _auto_split,
    _validate_labels,
    _IMAGE_EXTS,
)

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=0, name="app.tasks.gdrive_import.import_from_gdrive")
def import_from_gdrive(self: Task, dataset_id: int, gdrive_file_id: str) -> None:
    import json
    import yaml
    import zipfile
    from datetime import datetime

    from app.models.dataset import Dataset
    from app.services import gcs_client, gdrive_client

    db = SessionLocal()
    upload_id = str(uuid.uuid4())
    local_dir = Path(settings.EXTRACTION_PATH) / upload_id

    try:
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            logger.error("Dataset %d not found", dataset_id)
            return

        # ── 1. Download from Google Drive ────────────────────────────────────
        _set_status(db, dataset_id, "importing", "Downloading from Google Drive...")
        os.makedirs(local_dir, exist_ok=True)
        local_zip = local_dir / "upload.zip"
        gdrive_client.download_file(gdrive_file_id, str(local_zip))

        file_size = local_zip.stat().st_size
        original_filename = ds.original_filename or "gdrive_download.zip"

        # ── 2. Disk space check ──────────────────────────────────────────────
        free = shutil.disk_usage(settings.EXTRACTION_PATH).free
        # 2.5x multiplier: ZIPs with JPG/PNG images expand ~1.5-2x, not 5x (text/code ratio).
        _SPACE_FACTOR = 2.5
        if file_size * _SPACE_FACTOR > free:
            raise ValidationError(
                f"Insufficient disk space. "
                f"Need ~{int(file_size * _SPACE_FACTOR) // 1_073_741_824} GB, "
                f"available {free // 1_073_741_824} GB."
            )

        # ── 3. Validate ZIP integrity ────────────────────────────────────────
        _set_status(db, dataset_id, "extracting", "Validating ZIP integrity...")
        try:
            with zipfile.ZipFile(local_zip, "r") as zf:
                bad = zf.testzip()
                if bad:
                    raise ValidationError(f"ZIP file is corrupt (bad entry: {bad}).")
                namelist = zf.namelist()
        except zipfile.BadZipFile:
            raise ValidationError("The downloaded file is not a valid ZIP archive.")

        # ── 4. Detect layout + pre-validate structure ────────────────────────
        prefix = _detect_prefix(namelist)
        layout = _detect_layout(namelist, prefix)
        logger.info("GDrive dataset %d: layout=%s prefix=%r", dataset_id, layout, prefix)
        _validate_structure(namelist, prefix, layout)

        # ── 5. Extract ───────────────────────────────────────────────────────
        _set_status(db, dataset_id, "extracting", "Extracting files...")
        extract_dir = local_dir / "extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(local_zip, "r") as zf:
            zf.extractall(extract_dir)

        extract_root = extract_dir / prefix.rstrip("/") if prefix else extract_dir

        # ── 5b. Normalise layout ─────────────────────────────────────────────
        pre_counts = None
        if layout == "nested":
            _set_status(db, dataset_id, "extracting", "Restructuring dataset layout...")
            pre_counts = _restructure_nested(extract_root)
        elif layout == "flat":
            _set_status(db, dataset_id, "extracting", "Auto-splitting dataset into train/val (80/20)...")
            pre_counts = _auto_split(extract_root)

        # ── 6. Parse data.yaml ───────────────────────────────────────────────
        yaml_path = extract_root / "data.yaml"
        with open(yaml_path) as f:
            data_yaml = yaml.safe_load(f)

        nc = data_yaml.get("nc")
        class_names = data_yaml.get("names")

        # Handle names as dict {0: 'glove', 1: 'person'} → normalize to list
        if isinstance(class_names, dict):
            class_names = [class_names[k] for k in sorted(class_names.keys())]

        # Infer nc from names if missing
        if nc is None and class_names is not None:
            nc = len(class_names)
            logger.info("data.yaml missing 'nc', inferred nc=%d from names", nc)

        if nc is None:
            raise ValidationError("data.yaml missing required field 'nc' (and no 'names' to infer from).")
        if class_names is None:
            raise ValidationError("data.yaml missing required field 'names'.")
        if len(class_names) != nc:
            # Don't fail — just warn and trust names
            logger.warning("data.yaml nc=%d but %d names; using names count", nc, len(class_names))
            nc = len(class_names)

        # ── 7. Validate labels ───────────────────────────────────────────────
        _set_status(db, dataset_id, "validating", "Validating labels...")
        _validate_labels(extract_root, nc)

        # ── 8. Count images ──────────────────────────────────────────────────
        if pre_counts is not None:
            train_count, val_count = pre_counts
        else:
            train_count = len([f for f in (extract_root / "train" / "images").iterdir() if f.is_file()])
            val_count = len([f for f in (extract_root / "val" / "images").iterdir() if f.is_file()])

        image_count = train_count + val_count
        if image_count == 0:
            raise ValidationError("No images found after processing.")

        # ── 9. Generate canonical data.yaml ──────────────────────────────────
        canonical_yaml = {
            "path": f"gs://{settings.GCS_BUCKET}/datasets/gdrive/{upload_id}",
            "train": "train/images",
            "val": "val/images",
            "nc": nc,
            "names": class_names,
        }
        with open(yaml_path, "w") as f:
            yaml.dump(canonical_yaml, f, default_flow_style=False, allow_unicode=True)

        # ── 10. Generate metadata.json ───────────────────────────────────────
        metadata = {
            "source": "gdrive",
            "original_filename": original_filename,
            "gdrive_file_id": gdrive_file_id,
            "upload_id": upload_id,
            "original_layout": layout,
            "class_count": nc,
            "class_names": class_names,
            "image_count": image_count,
            "train_count": train_count,
            "val_count": val_count,
            "date": datetime.utcnow().isoformat(),
        }
        with open(extract_root / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        # ── 11. Upload to GCS ────────────────────────────────────────────────
        _set_status(db, dataset_id, "validating", "Uploading to storage...")
        gcs_prefix = f"datasets/gdrive/{upload_id}"
        gcs_client.upload_directory(str(extract_root), gcs_prefix)

        # ── 12. Mark ready ───────────────────────────────────────────────────
        _set_status(
            db, dataset_id, "ready", "Ready",
            gcs_path=f"{gcs_prefix}/",
            class_count=nc,
            image_count=image_count,
            class_names=class_names,
            upload_id=upload_id,
            file_size_bytes=file_size,
            celery_task_id=None,
        )
        logger.info("GDrive dataset %d ready — %d images, %d classes", dataset_id, image_count, nc)

    except ValidationError as exc:
        logger.warning("Validation error GDrive dataset %d: %s", dataset_id, exc)
        _set_status(db, dataset_id, "failed", error_message=str(exc), msg=None)

    except Exception as exc:
        logger.exception("Unexpected error importing GDrive dataset %d", dataset_id)
        _set_status(
            db, dataset_id, "failed",
            error_message=f"Import error: {exc}",
            msg=None,
        )

    finally:
        db.close()
        if local_dir.exists():
            shutil.rmtree(local_dir, ignore_errors=True)
