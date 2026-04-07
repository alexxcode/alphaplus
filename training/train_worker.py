"""
ALPHA PLUS — VM2 Training Worker (GCP startup script)
=====================================================
This script runs when the GPU VM (VM2) boots. It:
  1. Reads job configuration from GCS
  2. Downloads the dataset from GCS
  3. Runs YOLO training with per-epoch metric reporting
  4. Uploads results (best.pt, metrics.json) to GCS
  5. Registers the model version via the backend API
  6. ALWAYS shuts the VM down at the end (even on error)

Environment variables (set via VM metadata or .env):
  GCS_BUCKET       — GCS bucket name
  JOB_ID           — ID of the job to process
  ZONE             — GCP zone (for self-shutdown)
  BACKEND_API_URL  — http://VM1_INTERNAL_IP:8000
"""
import json
import logging
import os
import shutil
import sys
import time
from pathlib import Path

import requests
import yaml
from google.cloud import storage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config from environment ────────────────────────────────────────────────────
# These are set by the startup script from GCP instance metadata.
# BACKEND_API_URL should point to VM1's nginx on port 80 (not port 8000).
GCS_BUCKET      = os.environ.get("GCS_BUCKET", "")
JOB_ID          = os.environ.get("JOB_ID", "")
ZONE            = os.environ.get("ZONE", "us-central1-a")
BACKEND_URL     = os.environ.get("BACKEND_API_URL", "http://localhost:80")
DATASET_DIR     = Path("/tmp/dataset")
RESULTS_DIR     = Path("/tmp/runs/train")


# ── GCS helpers ───────────────────────────────────────────────────────────────

def gcs_client() -> storage.Client:
    return storage.Client()


def _remap_labels(dataset_dir: Path, remap: dict) -> None:
    """
    Rewrite all YOLO .txt label files in dataset_dir with remapped class IDs.

    Args:
        dataset_dir: root directory of the downloaded dataset
        remap: {str(old_class_id): new_class_id}  e.g. {"0": 2, "1": 5}
               Classes not in the map are left unchanged.
    """
    if not remap:
        return

    # Normalize to str→str for fast lookup
    remap_str = {str(k): str(v) for k, v in remap.items()}

    # Skip if every id maps to itself (identity — no work needed)
    if all(k == v for k, v in remap_str.items()):
        return

    n_files = 0
    for label_file in dataset_dir.rglob("*.txt"):
        if label_file.stat().st_size == 0:
            continue
        lines = label_file.read_text().splitlines()
        new_lines = []
        for line in lines:
            parts = line.strip().split()
            if not parts:
                continue
            old_cls = parts[0]
            new_cls = remap_str.get(old_cls, old_cls)
            new_lines.append(new_cls + " " + " ".join(parts[1:]))
        label_file.write_text("\n".join(new_lines) + "\n")
        n_files += 1

    logger.info("Remapped class IDs in %d label files in %s", n_files, dataset_dir)


def merge_datasets(
    bucket,
    dataset_gcs_paths: list[str],
    merged_dir: Path,
    merged_class_names: list[str] = None,
    dataset_remaps: list[dict] = None,
) -> None:
    """
    Download multiple datasets and merge them into a single YOLO dataset.

    Supports:
    - Same-class datasets: class IDs are identical, no remapping needed.
    - Complementary datasets: different class names get merged into a union,
      label files are rewritten with global class IDs.

    Args:
        bucket: GCS bucket object
        dataset_gcs_paths: GCS path prefix for each dataset
        merged_dir: local directory to write the merged dataset
        merged_class_names: ordered list of all class names in the merged dataset
        dataset_remaps: per-dataset class-id remapping {str(old_id): new_id}
    """
    merged_dir.mkdir(parents=True, exist_ok=True)
    for split in ("train", "val"):
        (merged_dir / split / "images").mkdir(parents=True, exist_ok=True)
        (merged_dir / split / "labels").mkdir(parents=True, exist_ok=True)

    fallback_yaml = None  # used only if merged_class_names was not pre-computed

    for idx, gcs_path in enumerate(dataset_gcs_paths):
        tmp_dir = Path(f"/tmp/dataset_part_{idx}")
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)

        logger.info("Downloading dataset %d/%d from %s", idx + 1, len(dataset_gcs_paths), gcs_path)
        download_dataset(bucket, gcs_path, tmp_dir)

        # Keep the first dataset's yaml as fallback (single-class-set scenario)
        part_yaml_path = tmp_dir / "data.yaml"
        if part_yaml_path.exists() and fallback_yaml is None:
            with open(part_yaml_path) as f:
                fallback_yaml = yaml.safe_load(f)

        # Remap class IDs in label files if this dataset has a non-identity mapping
        remap = dataset_remaps[idx] if dataset_remaps else None
        if remap:
            _remap_labels(tmp_dir, remap)

        # Copy images and labels with a per-dataset prefix to avoid filename collisions
        prefix = f"ds{idx}_"
        for split in ("train", "val"):
            src_imgs = tmp_dir / split / "images"
            src_lbls = tmp_dir / split / "labels"
            dst_imgs = merged_dir / split / "images"
            dst_lbls = merged_dir / split / "labels"

            if src_imgs.exists():
                for f in src_imgs.iterdir():
                    if f.is_file():
                        shutil.copy2(str(f), str(dst_imgs / f"{prefix}{f.name}"))
            if src_lbls.exists():
                for f in src_lbls.iterdir():
                    if f.is_file():
                        shutil.copy2(str(f), str(dst_lbls / f"{prefix}{f.name}"))

        shutil.rmtree(tmp_dir, ignore_errors=True)

    # Write merged data.yaml with the unified class list
    if merged_class_names:
        merged_yaml = {
            "path": str(merged_dir),
            "train": "train/images",
            "val": "val/images",
            "nc": len(merged_class_names),
            "names": merged_class_names,
        }
    elif fallback_yaml:
        merged_yaml = fallback_yaml
        merged_yaml["path"] = str(merged_dir)
        merged_yaml["train"] = "train/images"
        merged_yaml["val"] = "val/images"
    else:
        raise RuntimeError("No data.yaml found in any dataset and no merged_class_names provided.")

    with open(merged_dir / "data.yaml", "w") as f:
        yaml.dump(merged_yaml, f)

    total_train = len(list((merged_dir / "train" / "images").iterdir()))
    total_val = len(list((merged_dir / "val" / "images").iterdir()))
    logger.info(
        "Merged %d datasets: %d train + %d val = %d total images | classes: %s",
        len(dataset_gcs_paths), total_train, total_val, total_train + total_val,
        merged_class_names or merged_yaml.get("names"),
    )


def download_dataset(bucket, dataset_gcs_path: str, local_dir: Path) -> None:
    """Download all files from GCS dataset path to local_dir."""
    logger.info("Downloading dataset from gs://%s/%s", GCS_BUCKET, dataset_gcs_path)
    blobs = list(bucket.list_blobs(prefix=dataset_gcs_path))
    local_dir.mkdir(parents=True, exist_ok=True)

    for blob in blobs:
        relative = blob.name[len(dataset_gcs_path):]
        if not relative or relative.endswith("/"):
            continue
        local_path = local_dir / relative
        local_path.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(local_path))

    logger.info("Downloaded %d files to %s", len(blobs), local_dir)


def get_next_version(bucket, model_name: str) -> int:
    """Find the next version number for the given model name."""
    prefix = f"models/{model_name}/"
    iterator = bucket.list_blobs(prefix=prefix, delimiter="/")
    versions = []
    for page in iterator.pages:
        for p in page.prefixes:
            ver_str = p.rstrip("/").split("/")[-1]
            if ver_str.startswith("v"):
                try:
                    versions.append(int(ver_str[1:]))
                except ValueError:
                    pass
    return max(versions, default=0) + 1


def upload_results(bucket, model_name: str, version: int, run_dir: Path) -> str:
    """Upload training artifacts to GCS and return the GCS prefix."""
    gcs_prefix = f"models/{model_name}/v{version}"
    artifacts = {
        run_dir / "weights" / "best.pt": f"{gcs_prefix}/best.pt",
        run_dir / "weights" / "last.pt": f"{gcs_prefix}/last.pt",
    }
    for local, gcs_path in artifacts.items():
        if local.exists():
            blob = bucket.blob(gcs_path)
            blob.upload_from_filename(str(local))
            logger.info("Uploaded %s → gs://%s/%s", local.name, GCS_BUCKET, gcs_path)
    return gcs_prefix + "/"


# ── Backend API helpers ────────────────────────────────────────────────────────

def api(method: str, path: str, **kwargs):
    url = f"{BACKEND_URL}{path}"
    try:
        resp = requests.request(method, url, timeout=30, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("API call %s %s failed: %s", method, path, exc)
        return None


def update_job_status(job_id: str, status: str, error_message: str = None) -> None:
    payload = {"status": status}
    if error_message:
        payload["error_message"] = error_message
    api("PATCH", f"/api/training/jobs/{job_id}", json=payload)


def report_epoch_metric(job_id: str, epoch: int, metrics: dict) -> None:
    payload: dict = {"epoch": epoch}
    for field, key in [
        ("train_loss", "train/box_loss"),
        ("val_loss",   "val/box_loss"),
        ("map50",      "metrics/mAP50(B)"),
        ("map50_95",   "metrics/mAP50-95(B)"),
    ]:
        v = metrics.get(key)
        if v is not None:
            try:
                payload[field] = float(v)
            except (TypeError, ValueError):
                pass
    api("POST", f"/api/training/jobs/{job_id}/metrics", json=payload)


def register_model_version(job_id: str, model_name: str, version: int,
                            gcs_path: str, results) -> None:
    metrics = results.results_dict if hasattr(results, "results_dict") else {}
    api("POST", "/api/models", json={
        "job_id":    int(job_id),
        "model_name": model_name,
        "version":   version,
        "gcs_path":  gcs_path,
        "map50":     metrics.get("metrics/mAP50(B)"),
        "precision": metrics.get("metrics/precision(B)"),
        "recall":    metrics.get("metrics/recall(B)"),
    })


# ── Ultralytics callback ───────────────────────────────────────────────────────

def make_on_fit_epoch_end(job_id: str):
    def on_fit_epoch_end(trainer):
        epoch   = trainer.epoch + 1
        metrics = trainer.metrics
        logger.info("Epoch %d — mAP50: %.4f", epoch, metrics.get("metrics/mAP50(B)", 0))
        report_epoch_metric(job_id, epoch, metrics)
    return on_fit_epoch_end


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if not GCS_BUCKET or not JOB_ID:
        logger.error("GCS_BUCKET and JOB_ID must be set.")
        sys.exit(1)

    client = gcs_client()
    bucket = client.bucket(GCS_BUCKET)
    results = None

    try:
        # ── Read job config from GCS ──────────────────────────────────────────
        config_path = f"jobs/pending/{JOB_ID}/config.json"
        config_blob = bucket.blob(config_path)
        if not config_blob.exists():
            raise RuntimeError(f"Job config not found at gs://{GCS_BUCKET}/{config_path}")

        config = json.loads(config_blob.download_as_text())
        dataset_gcs_paths = config.get("dataset_gcs_paths", [config["dataset_gcs_path"]])
        model_type  = config["model_type"]
        model_name  = config["model_name"]
        inner_cfg   = config.get("config", {})
        epochs      = inner_cfg.get("epochs", 100)
        batch_size  = inner_cfg.get("batch_size", -1)
        # Class union info for multi-dataset training (may be None for single datasets)
        merged_class_names = inner_cfg.get("merged_class_names")
        dataset_remaps     = inner_cfg.get("dataset_remaps")

        # Use backend URL from job config if available (overrides env var)
        global BACKEND_URL
        if config.get("backend_api_url"):
            BACKEND_URL = config["backend_api_url"]
            logger.info("Using backend URL from job config: %s", BACKEND_URL)

        multi_dataset = len(dataset_gcs_paths) > 1
        logger.info(
            "Job %s: model=%s, datasets=%s (%d total)",
            JOB_ID, model_type, dataset_gcs_paths, len(dataset_gcs_paths),
        )
        update_job_status(JOB_ID, "training")

        # ── Download dataset(s) ──────────────────────────────────────────────
        if DATASET_DIR.exists():
            shutil.rmtree(DATASET_DIR)

        if multi_dataset:
            # Download each dataset, remap class IDs if needed, merge into DATASET_DIR
            merge_datasets(
                bucket, dataset_gcs_paths, DATASET_DIR,
                merged_class_names=merged_class_names,
                dataset_remaps=dataset_remaps,
            )
        else:
            download_dataset(bucket, dataset_gcs_paths[0], DATASET_DIR)

        # ── Find data.yaml ────────────────────────────────────────────────────
        yaml_path = DATASET_DIR / "data.yaml"
        if not yaml_path.exists():
            raise FileNotFoundError(f"data.yaml not found in {DATASET_DIR}")

        # Rewrite paths to local absolute paths for training
        with open(yaml_path) as f:
            data_cfg = yaml.safe_load(f)
        data_cfg["path"] = str(DATASET_DIR)
        data_cfg["train"] = "train/images"
        data_cfg["val"]   = "val/images"
        with open(yaml_path, "w") as f:
            yaml.dump(data_cfg, f)

        # ── Train ─────────────────────────────────────────────────────────────
        from ultralytics import YOLO
        model = YOLO(f"{model_type}.pt")
        model.add_callback("on_fit_epoch_end", make_on_fit_epoch_end(JOB_ID))

        results = model.train(
            data=str(yaml_path),
            epochs=epochs,
            batch=batch_size,
            project="/tmp/runs",
            name="train",
            exist_ok=True,
        )
        logger.info("Training complete. mAP50: %.4f", results.results_dict.get("metrics/mAP50(B)", 0))

        # ── Upload results ────────────────────────────────────────────────────
        version = get_next_version(bucket, model_name)
        gcs_path = upload_results(bucket, model_name, version, RESULTS_DIR)

        # ── Write metrics.json ────────────────────────────────────────────────
        metrics_dict = results.results_dict if hasattr(results, "results_dict") else {}
        metrics_json = json.dumps({
            "mAP50":     metrics_dict.get("metrics/mAP50(B)"),
            "mAP50_95":  metrics_dict.get("metrics/mAP50-95(B)"),
            "precision": metrics_dict.get("metrics/precision(B)"),
            "recall":    metrics_dict.get("metrics/recall(B)"),
            "epochs":    epochs,
            "model_type": model_type,
        }, indent=2)
        bucket.blob(f"models/{model_name}/v{version}/metrics.json").upload_from_string(
            metrics_json, content_type="application/json"
        )

        # ── Register in backend ───────────────────────────────────────────────
        register_model_version(JOB_ID, model_name, version, gcs_path, results)

        # ── Mark job completed ────────────────────────────────────────────────
        update_job_status(JOB_ID, "completed")
        logger.info("Job %s completed. Model: gs://%s/%s", JOB_ID, GCS_BUCKET, gcs_path)

    except Exception as exc:
        logger.exception("Training failed for job %s", JOB_ID)
        error_msg = str(exc)

        # Upload error log to GCS so it can be inspected after VM shuts down
        try:
            log_path = f"logs/job-{JOB_ID}-error.txt"
            import traceback
            bucket.blob(log_path).upload_from_string(
                traceback.format_exc(), content_type="text/plain"
            )
            logger.info("Error log uploaded to gs://%s/%s", GCS_BUCKET, log_path)
        except Exception:
            pass  # Don't let log upload failure prevent shutdown

        update_job_status(JOB_ID, "failed", error_msg)

    finally:
        logger.info("Shutting down VM (zone=%s)…", ZONE)
        # This runs even if training fails — protects against runaway GPU costs
        os.system(f"gcloud compute instances stop $(hostname) --zone={ZONE}")


if __name__ == "__main__":
    main()
