"""
Celery task — extract and validate a manually uploaded YOLO dataset ZIP.

Accepted layouts (auto-detected)
──────────────────────────────────────────────────────────────────
  A) split   — standard YOLO split:
               train/images/  train/labels/  val/images/  val/labels/

  B) nested  — images & labels in parallel trees with train/val inside:
               images/train/  images/val/  labels/train/  labels/val/
               → restructured to layout A in-place

  C) flat    — single images/ + labels/ pool, no train/val:
               images/  labels/
               → auto-split 80/20 into layout A

Flow:
  1.  Download ZIP from GCS temp-uploads/
  2.  Validate ZIP integrity
  3.  Detect layout + pre-validate YOLO structure (on namelist, before extraction)
  4.  Extract to local scratch disk
  5.  If nested → restructure to split; if flat → auto-split 80/20
  6.  Parse & validate data.yaml
  7.  Sample-validate 5% of label files
  8.  Generate canonical data.yaml + metadata.json
  9.  Upload extracted files to GCS datasets/manual/{upload_id}/
  10. Update DB record → status="ready"
  11. Always: cleanup local files + delete GCS temp ZIP
"""
import json
import logging
import os
import random
import shutil
import zipfile
from datetime import datetime
from pathlib import Path

import yaml
from celery import Task

from app.config import settings
from app.database import SessionLocal
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}


# ── Custom exceptions ──────────────────────────────────────────────────────────

class ValidationError(Exception):
    """User-visible validation failure — stored in dataset.error_message."""


# ── Layout detection ───────────────────────────────────────────────────────────

def _detect_prefix(namelist: list[str]) -> str:
    """
    If all entries share a common root folder (e.g. "dataset13/train/…")
    return that root ("dataset13/"). Otherwise return "".
    """
    if not namelist:
        return ""
    first_parts = namelist[0].split("/")
    if len(first_parts) < 2:
        return ""
    candidate = first_parts[0] + "/"
    if all(n.startswith(candidate) for n in namelist if n):
        return candidate
    return ""


def _detect_layout(namelist: list[str], prefix: str) -> str:
    """
    Detect the directory layout of the YOLO dataset inside the ZIP.

    Returns one of: "split" | "nested" | "flat" | "unknown"
    """
    def _has(d: str) -> bool:
        return any(n.startswith(prefix + d) for n in namelist)

    # A) Standard split: train/images/ + val/images/
    if _has("train/images/") and _has("val/images/"):
        return "split"

    # B) Nested: images/train/ + images/val/ (train/val inside images & labels)
    if _has("images/train/") and _has("images/val/"):
        return "nested"

    # C) Flat: images/ + labels/ with files directly inside (no train/val subdirs)
    if _has("images/") and _has("labels/"):
        return "flat"

    return "unknown"


def _validate_structure(namelist: list[str], prefix: str, layout: str) -> None:
    """Check that the required paths for the detected layout are present."""
    if layout == "split":
        required = [
            "data.yaml",
            "train/images/",
            "train/labels/",
            "val/images/",
            "val/labels/",
        ]
    elif layout == "nested":
        required = [
            "data.yaml",
            "images/train/",
            "images/val/",
            "labels/train/",
            "labels/val/",
        ]
    elif layout == "flat":
        required = [
            "data.yaml",
            "images/",
            "labels/",
        ]
    else:
        raise ValidationError(
            "Unrecognized dataset structure. Accepted layouts:\n"
            "  (A) train/images/ + train/labels/ + val/images/ + val/labels/\n"
            "  (B) images/train/ + images/val/ + labels/train/ + labels/val/\n"
            "  (C) images/ + labels/  (flat — auto-split 80/20)\n"
            "All layouts require data.yaml."
        )

    errors = []
    for req in required:
        full = prefix + req
        if req.endswith("/"):
            found = any(n.startswith(full) for n in namelist)
        else:
            found = any(n == full for n in namelist)
        if not found:
            label = f"directory '{req.rstrip('/')}'" if req.endswith("/") else f"file '{req}'"
            errors.append(f"Missing required {label}")
    if errors:
        raise ValidationError("; ".join(errors))


# ── Layout normalisation ───────────────────────────────────────────────────────

def _restructure_nested(extract_root: Path) -> tuple[int, int]:
    """
    Convert nested layout  (images/train/, images/val/, labels/train/, labels/val/)
    to standard split layout (train/images/, train/labels/, val/images/, val/labels/).
    Returns (train_count, val_count).
    """
    for split in ("train", "val"):
        src_imgs = extract_root / "images" / split
        src_lbls = extract_root / "labels" / split
        dst_imgs = extract_root / split / "images"
        dst_lbls = extract_root / split / "labels"

        dst_imgs.mkdir(parents=True, exist_ok=True)
        dst_lbls.mkdir(parents=True, exist_ok=True)

        if src_imgs.exists():
            for f in src_imgs.iterdir():
                if f.is_file():
                    shutil.move(str(f), str(dst_imgs / f.name))
        if src_lbls.exists():
            for f in src_lbls.iterdir():
                if f.is_file():
                    shutil.move(str(f), str(dst_lbls / f.name))

    # Remove old parallel-tree dirs
    shutil.rmtree(str(extract_root / "images"), ignore_errors=True)
    shutil.rmtree(str(extract_root / "labels"), ignore_errors=True)

    train_count = len([f for f in (extract_root / "train" / "images").iterdir() if f.is_file()])
    val_count   = len([f for f in (extract_root / "val"   / "images").iterdir() if f.is_file()])
    logger.info("Nested → split restructure: %d train / %d val", train_count, val_count)
    return train_count, val_count


def _auto_split(extract_root: Path, train_ratio: float = 0.8) -> tuple[int, int]:
    """
    Convert flat layout (images/, labels/) to standard split layout.
    Files matched by stem; images without a matching label are included.
    Returns (train_count, val_count).
    """
    images_dir = extract_root / "images"
    labels_dir = extract_root / "labels"

    # rglob handles both flat (images/*.jpg) and subdirectory layouts (images/subdir/*.jpg)
    all_images = sorted(
        f for f in images_dir.rglob("*")
        if f.is_file() and f.suffix.lower() in _IMAGE_EXTS
    )
    if not all_images:
        # Log what IS in images/ to diagnose structure issues
        entries = [str(p.relative_to(images_dir)) for p in images_dir.rglob("*")][:30]
        logger.error("images/ contents (first 30): %s", entries)
        raise ValidationError("No images found in images/")

    rng = random.Random(42)
    rng.shuffle(all_images)

    split_idx = max(1, int(len(all_images) * train_ratio))
    train_imgs = all_images[:split_idx]
    val_imgs   = all_images[split_idx:]

    for split in ("train", "val"):
        (extract_root / split / "images").mkdir(parents=True, exist_ok=True)
        (extract_root / split / "labels").mkdir(parents=True, exist_ok=True)

    # Track used dest names to handle collisions when flattening subdirectories
    _used: set = set()

    def _dest_name(img: Path) -> str:
        name = img.name
        if name not in _used:
            _used.add(name)
            return name
        # Prefix with immediate parent dir to resolve collision
        name = f"{img.parent.name}_{img.name}"
        if name not in _used:
            _used.add(name)
            return name
        name = f"{img.parent.name}_{img.stem}_{img.stat().st_ino}{img.suffix}"
        _used.add(name)
        return name

    def _move_pair(img: Path, split: str) -> None:
        dest = _dest_name(img)
        shutil.move(str(img), str(extract_root / split / "images" / dest))
        # Try label next to image first, then recursively in labels_dir
        lbl = img.parent.parent / "labels" / (img.stem + ".txt") if img.parent != images_dir else None
        if lbl is None or not lbl.exists():
            lbl = labels_dir / (img.stem + ".txt")
        if not lbl.exists():
            matches = list(labels_dir.rglob(img.stem + ".txt"))
            lbl = matches[0] if matches else None
        if lbl and lbl.exists():
            shutil.move(str(lbl), str(extract_root / split / "labels" / (Path(dest).stem + ".txt")))

    for img in train_imgs:
        _move_pair(img, "train")
    for img in val_imgs:
        _move_pair(img, "val")

    shutil.rmtree(str(images_dir), ignore_errors=True)
    shutil.rmtree(str(labels_dir), ignore_errors=True)

    logger.info(
        "Auto-split (flat → split): %d train / %d val (%.0f%%)",
        len(train_imgs), len(val_imgs), train_ratio * 100,
    )
    return len(train_imgs), len(val_imgs)


# ── Label validation ───────────────────────────────────────────────────────────

def _validate_labels(extract_root: Path, nc: int, sample_rate: float = 0.05) -> None:
    """Sample-validate YOLO label files in train/labels/ (after normalisation)."""
    label_dir = extract_root / "train" / "labels"
    label_files = list(label_dir.glob("*.txt"))
    if not label_files:
        raise ValidationError("No label files found in train/labels/")

    n_sample = max(10, int(len(label_files) * sample_rate))
    sample = random.sample(label_files, min(n_sample, len(label_files)))
    errors: list[str] = []

    for lf in sample:
        with open(lf) as f:
            for lineno, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) != 5:
                    errors.append(f"{lf.name}:{lineno}: expected 5 fields, got {len(parts)}")
                    continue
                try:
                    cls_id = int(parts[0])
                    coords = [float(p) for p in parts[1:]]
                except ValueError:
                    errors.append(f"{lf.name}:{lineno}: non-numeric values")
                    continue
                if cls_id >= nc:
                    errors.append(f"{lf.name}:{lineno}: class_id {cls_id} >= nc {nc}")
                if not all(0.0 <= c <= 1.0 for c in coords):
                    errors.append(f"{lf.name}:{lineno}: coordinates outside [0, 1]")
        if len(errors) >= 5:
            break

    if errors:
        raise ValidationError("Label validation errors: " + "; ".join(errors[:5]))


# ── DB helper ──────────────────────────────────────────────────────────────────

def _set_status(db, dataset_id: int, status: str, msg: str = None, **kwargs) -> None:
    from app.models.dataset import Dataset
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if ds:
        ds.status = status
        if msg is not None:
            ds.progress_message = msg
        for k, v in kwargs.items():
            setattr(ds, k, v)
        db.commit()


# ── Celery task ────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=0, name="app.tasks.dataset_extraction.extract_dataset_zip")
def extract_dataset_zip(self: Task, dataset_id: int, upload_id: str) -> None:
    from app.models.dataset import Dataset
    from app.services import gcs_client

    db = SessionLocal()
    local_dir = Path(settings.EXTRACTION_PATH) / upload_id

    try:
        # ── Load dataset record ───────────────────────────────────────────────
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            logger.error("Dataset %d not found", dataset_id)
            return

        file_size = ds.file_size_bytes or 0
        original_filename = ds.original_filename or "upload.zip"

        # ── 1. Disk space check ───────────────────────────────────────────────
        _set_status(db, dataset_id, "extracting", "Checking disk space…")
        os.makedirs(local_dir, exist_ok=True)
        free = shutil.disk_usage(settings.EXTRACTION_PATH).free
        if file_size * 5 > free:
            raise ValidationError(
                f"Insufficient disk space. "
                f"Need ~{(file_size * 5) // 1_073_741_824} GB, "
                f"available {free // 1_073_741_824} GB."
            )

        # ── 2. Download ZIP ───────────────────────────────────────────────────
        _set_status(db, dataset_id, "extracting", "Downloading ZIP from storage…")
        local_zip = local_dir / "upload.zip"
        gcs_client.download_temp_zip(upload_id, str(local_zip))

        # ── 3. Validate ZIP integrity ─────────────────────────────────────────
        try:
            with zipfile.ZipFile(local_zip, "r") as zf:
                bad = zf.testzip()
                if bad:
                    raise ValidationError(
                        f"ZIP file is corrupt (bad entry: {bad}). Please re-create and retry."
                    )
                namelist = zf.namelist()
        except zipfile.BadZipFile:
            raise ValidationError("The uploaded file is not a valid ZIP archive.")

        # ── 4. Detect layout + pre-validate structure ─────────────────────────
        prefix = _detect_prefix(namelist)
        layout = _detect_layout(namelist, prefix)
        logger.info("Dataset %d: layout=%s  prefix=%r", dataset_id, layout, prefix)
        _validate_structure(namelist, prefix, layout)

        # ── 5. Extract ────────────────────────────────────────────────────────
        _set_status(db, dataset_id, "extracting", "Extracting files…")
        extract_dir = local_dir / "extracted"
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(local_zip, "r") as zf:
            zf.extractall(extract_dir)

        extract_root = extract_dir / prefix.rstrip("/") if prefix else extract_dir

        # ── 5b. Normalise layout → standard split ─────────────────────────────
        pre_counts: tuple[int, int] | None = None

        if layout == "nested":
            _set_status(db, dataset_id, "extracting", "Restructuring dataset layout…")
            pre_counts = _restructure_nested(extract_root)

        elif layout == "flat":
            _set_status(
                db, dataset_id, "extracting",
                "Auto-splitting dataset into train/val (80/20)…"
            )
            pre_counts = _auto_split(extract_root)

        # ── 6. Parse data.yaml ────────────────────────────────────────────────
        yaml_path = extract_root / "data.yaml"
        with open(yaml_path) as f:
            data_yaml = yaml.safe_load(f)

        nc          = data_yaml.get("nc")
        class_names = data_yaml.get("names")
        if nc is None:
            raise ValidationError("data.yaml missing required field 'nc'.")
        if class_names is None:
            raise ValidationError("data.yaml missing required field 'names'.")
        if len(class_names) != nc:
            raise ValidationError(
                f"data.yaml inconsistency: nc={nc} but {len(class_names)} names listed."
            )

        # ── 7. Validate labels (sample) ───────────────────────────────────────
        _set_status(db, dataset_id, "validating", "Validating labels…")
        _validate_labels(extract_root, nc)

        # ── 8. Count images ───────────────────────────────────────────────────
        if pre_counts is not None:
            train_count, val_count = pre_counts
        else:
            train_count = len([
                f for f in (extract_root / "train" / "images").iterdir() if f.is_file()
            ])
            val_count = len([
                f for f in (extract_root / "val" / "images").iterdir() if f.is_file()
            ])

        image_count = train_count + val_count
        if image_count == 0:
            raise ValidationError("No images found after processing.")

        # ── 9. Generate canonical data.yaml ───────────────────────────────────
        canonical_yaml = {
            "path": f"gs://{settings.GCS_BUCKET}/datasets/manual/{upload_id}",
            "train": "train/images",
            "val": "val/images",
            "nc": nc,
            "names": class_names,
        }
        with open(yaml_path, "w") as f:
            yaml.dump(canonical_yaml, f, default_flow_style=False, allow_unicode=True)

        # ── 10. Generate metadata.json ────────────────────────────────────────
        metadata = {
            "source": "manual",
            "original_filename": original_filename,
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

        # ── 11. Upload to GCS ─────────────────────────────────────────────────
        _set_status(db, dataset_id, "validating", "Uploading to storage…")
        gcs_prefix = f"datasets/manual/{upload_id}"
        gcs_client.upload_directory(str(extract_root), gcs_prefix)

        # ── 12. Mark ready ────────────────────────────────────────────────────
        _set_status(
            db, dataset_id, "ready", "Ready",
            gcs_path=f"{gcs_prefix}/",
            class_count=nc,
            image_count=image_count,
            class_names=class_names,
            celery_task_id=None,
        )
        logger.info(
            "Dataset %d ready — %d images, %d classes, layout=%s",
            dataset_id, image_count, nc, layout,
        )

    except ValidationError as exc:
        logger.warning("Validation error dataset %d: %s", dataset_id, exc)
        _set_status(db, dataset_id, "failed", error_message=str(exc), msg=None)

    except Exception as exc:
        logger.exception("Unexpected error extracting dataset %d", dataset_id)
        _set_status(
            db, dataset_id, "failed",
            error_message="Internal processing error. Contact support.",
            msg=None,
        )

    finally:
        db.close()
        if local_dir.exists():
            shutil.rmtree(local_dir, ignore_errors=True)
        try:
            from app.services import gcs_client
            gcs_client.delete_temp_zip(upload_id)
        except Exception:
            pass
