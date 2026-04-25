"""
Celery task — GPU VM lifecycle management for training jobs.

Flow:
  1. Write job config to GCS
  2. Set alphaplus-job-id VM metadata
  3. Start GPU VM (VM2)
  4. Wait until VM reaches RUNNING (with boot grace period)
  5. Mark job as "training"
  6. Poll until VM self-terminates (training done or failed)
  7. Update job record with final status
"""
import json
import logging
import time
from datetime import datetime

from app.config import settings
from app.database import SessionLocal
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# ── Timing constants ───────────────────────────────────────────────────────────
_VM_START_GRACE_S  = 45          # Wait after start() before first status poll
                                  # (GCP needs ~15-30 s to change from TERMINATED → STAGING)
_VM_BOOT_TIMEOUT_S = 600         # 10 min max for STAGING → RUNNING
_TRAINING_TIMEOUT_S = 14_400     # 4 h max training
_POLL_INTERVAL_S   = 30          # Status poll interval


def _set_job_status(db, job_id: int, status: str, **kwargs):
    from app.models.job import Job
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.status = status
        for k, v in kwargs.items():
            setattr(job, k, v)
        db.commit()


@celery_app.task(bind=True, max_retries=0, name="app.tasks.vm_tasks.launch_training_job")
def launch_training_job(self, job_id: int):
    from app.models.job import Job
    from app.models.dataset import Dataset
    from app.services import vm_lifecycle, gcs_client

    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error("Job %d not found", job_id)
            return

        # Resolve all datasets for multi-dataset training
        all_dataset_ids = job.dataset_ids or [job.dataset_id]
        dataset_gcs_paths = []
        for did in all_dataset_ids:
            ds = db.query(Dataset).filter(Dataset.id == did).first()
            if ds and ds.gcs_path:
                dataset_gcs_paths.append(ds.gcs_path)

        if not dataset_gcs_paths:
            raise RuntimeError(f"No valid dataset paths found for job {job_id}")

        # ── 1. Write job config to GCS ────────────────────────────────────────
        config_path = f"jobs/pending/{job_id}/config.json"
        job_config = {
            "job_id": job_id,
            "dataset_gcs_path": dataset_gcs_paths[0],  # primary (backwards compat)
            "dataset_gcs_paths": dataset_gcs_paths,     # all datasets
            "model_type": job.model_type,
            "model_name": job.model_name,
            "config": job.config or {},
            # VM1 is reachable from VM2 via port 80 (nginx reverse proxy)
            "backend_api_url": f"http://{settings.APP_VM_INTERNAL_IP}",
        }
        gcs_client.upload_text(json.dumps(job_config, indent=2), config_path)
        logger.info("Wrote job config to GCS: %s", config_path)

        # ── 2. Set VM metadata so startup script knows which job to run ───────
        vm_lifecycle.set_vm_metadata("alphaplus-job-id", str(job_id))
        logger.info("VM metadata set: alphaplus-job-id=%d", job_id)

        # ── 3. Start GPU VM ───────────────────────────────────────────────────
        _set_job_status(db, job_id, "provisioning")
        logger.info("Starting GPU VM for job %d", job_id)
        vm_lifecycle.start_training_vm()

        # ── 4. Wait for VM to reach RUNNING ───────────────────────────────────
        # Give GCP time to acknowledge the start and transition from TERMINATED
        # to STAGING before the first poll. Without this, the very first check
        # may still return TERMINATED and cause a false failure.
        logger.info("Waiting %ds boot grace period for job %d...", _VM_START_GRACE_S, job_id)
        time.sleep(_VM_START_GRACE_S)

        deadline = time.time() + _VM_BOOT_TIMEOUT_S
        seen_non_terminated = False

        while time.time() < deadline:
            vm_status = vm_lifecycle.get_vm_status()
            logger.info("Job %d — VM status: %s", job_id, vm_status)

            if vm_status == "RUNNING":
                seen_non_terminated = True
                break

            if vm_status in ("STAGING", "PROVISIONING"):
                seen_non_terminated = True
                time.sleep(_POLL_INTERVAL_S)
                continue

            if vm_status in ("TERMINATED", "STOPPED"):
                if seen_non_terminated:
                    # VM started and shut down before we could catch RUNNING
                    # (training completed very fast — check final status below)
                    logger.warning(
                        "Job %d: VM went %s before Celery saw RUNNING. "
                        "Checking final job status...", job_id, vm_status
                    )
                    break
                else:
                    # GCP may still be processing the start request — keep waiting
                    logger.info(
                        "Job %d: VM still %s (GCP processing start)...", job_id, vm_status
                    )
                    time.sleep(_POLL_INTERVAL_S)
                    continue

            # Unknown status — keep polling
            time.sleep(_POLL_INTERVAL_S)
        else:
            raise RuntimeError(
                f"VM did not become RUNNING within {_VM_BOOT_TIMEOUT_S // 60} minutes"
            )

        # ── 5. Mark training started ──────────────────────────────────────────
        # Only set "training" if VM2 hasn't already updated the status
        # (e.g. fast-completing jobs that already reported "completed"/"failed")
        db.expire_all()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job and job.status not in ("completed", "failed"):
            _set_job_status(db, job_id, "training", start_time=datetime.utcnow())
            logger.info("Job %d — marked as training", job_id)
        else:
            logger.info("Job %d — VM already reported status '%s', skipping training mark", job_id, job.status if job else "unknown")
            return

        # ── 6. Poll until VM terminates (self-shutdown after training) ────────
        deadline = time.time() + _TRAINING_TIMEOUT_S
        while time.time() < deadline:
            vm_status = vm_lifecycle.get_vm_status()

            if vm_status in ("TERMINATED", "STOPPED"):
                logger.info("VM terminated — training for job %d is done", job_id)
                break

            # VM2 may update job status directly via API (completed / failed)
            db.expire_all()
            job = db.query(Job).filter(Job.id == job_id).first()
            if job and job.status in ("completed", "failed"):
                logger.info("Job %d reached status '%s' via VM API update", job_id, job.status)
                return

            time.sleep(_POLL_INTERVAL_S)
        else:
            logger.error("Job %d exceeded %dh timeout", job_id, _TRAINING_TIMEOUT_S // 3600)
            _set_job_status(
                db, job_id, "failed",
                error_message="Training timeout exceeded.",
                end_time=datetime.utcnow(),
            )
            return

        # ── 7. Check final outcome after VM terminates ────────────────────────
        # VM2 updates status via PATCH /api/training/jobs/{id}.
        # If status is still "training", VM2's callback didn't reach us —
        # check GCS for a success marker; otherwise mark as failed.
        db.expire_all()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job and job.status not in ("completed", "failed"):
            # Check GCS for training output as confirmation
            # Find the latest model version dynamically (not hardcoded to v1)
            try:
                versions = gcs_client.get_model_versions(job.model_name)
                if versions:
                    latest = max(versions, key=lambda v: int(v["version"].lstrip("v")))
                    model_exists = gcs_client.blob_exists(f"{latest['gcs_path']}best.pt")
                else:
                    model_exists = False
            except Exception:
                model_exists = False

            if model_exists:
                logger.info("Job %d: model found in GCS despite missing API callback", job_id)
                _set_job_status(db, job_id, "completed", end_time=datetime.utcnow())
            else:
                logger.warning(
                    "Job %d: VM terminated but no model in GCS and status still 'training' — "
                    "marking failed. Check gs://%s/logs/ for training logs.",
                    job_id, settings.GCS_BUCKET,
                )
                _set_job_status(
                    db, job_id, "failed",
                    error_message=(
                        "Training VM terminated without updating job status. "
                        "Check GCS logs for details."
                    ),
                    end_time=datetime.utcnow(),
                )

    except Exception as exc:
        logger.exception("Error in launch_training_job for job %d", job_id)
        _set_job_status(
            db, job_id, "failed",
            error_message=str(exc),
            end_time=datetime.utcnow(),
        )
    finally:
        db.close()
