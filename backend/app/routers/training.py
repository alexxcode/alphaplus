"""
Training endpoints:
  POST /api/training/jobs              — launch a training job
  GET  /api/training/jobs              — list all jobs
  GET  /api/training/jobs/{id}         — get single job
  GET  /api/training/jobs/{id}/metrics — get epoch metrics
  POST /api/training/jobs/{id}/metrics — (VM2) report per-epoch metrics
  PATCH /api/training/jobs/{id}        — (VM2) update job status
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset
from app.models.job import Job, TrainingMetric

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_MODEL_TYPES = [
    "yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x",
    "yolo11n", "yolo11s", "yolo11m", "yolo11l", "yolo11x",
]


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    dataset_id: int = None           # single dataset (backwards compat)
    dataset_ids: list[int] = None    # multiple datasets
    model_type: str
    model_name: str
    epochs: int = 100
    batch_size: int = -1


class MetricReport(BaseModel):
    epoch: int
    train_loss: Optional[float] = None
    val_loss: Optional[float] = None
    map50: Optional[float] = None
    map50_95: Optional[float] = None


class JobStatusUpdate(BaseModel):
    status: str
    error_message: str = None


# ── Job CRUD ───────────────────────────────────────────────────────────────────

@router.post("/jobs", status_code=201)
def create_job(body: CreateJobRequest, db: Session = Depends(get_db)):
    # Resolve dataset IDs — support both single and multi
    ids = body.dataset_ids or ([body.dataset_id] if body.dataset_id else [])
    if not ids:
        raise HTTPException(400, "At least one dataset is required.")

    # Validate all datasets
    datasets_list = []
    for did in ids:
        ds = db.query(Dataset).filter(Dataset.id == did).first()
        if not ds:
            raise HTTPException(404, f"Dataset {did} not found.")
        if ds.status != "ready":
            raise HTTPException(400, f"Dataset {did} is not ready (status: {ds.status}).")
        datasets_list.append(ds)

    # Validate model type
    if body.model_type not in VALID_MODEL_TYPES:
        raise HTTPException(400, f"Invalid model_type. Choose from: {VALID_MODEL_TYPES}")

    # ── Compute class union for multi-dataset training ────────────────────────
    # Rules:
    #   - Same class name across datasets → same global class (compatible, no remap)
    #   - Different class names across datasets → complementary, merged into union
    #   - All combinations are valid; we never block by name alone
    merged_class_names = None
    dataset_remaps = None

    if len(datasets_list) > 1:
        name_to_global_id: dict[str, int] = {}
        dataset_remaps = []

        for ds in datasets_list:
            names = ds.class_names or []
            local_remap: dict[str, int] = {}
            for local_id, name in enumerate(names):
                if name not in name_to_global_id:
                    name_to_global_id[name] = len(name_to_global_id)
                local_remap[str(local_id)] = name_to_global_id[name]
            dataset_remaps.append(local_remap)

        merged_class_names = [
            name for name, _ in sorted(name_to_global_id.items(), key=lambda x: x[1])
        ]
        logger.info(
            "Multi-dataset training: %d datasets → %d merged classes: %s",
            len(datasets_list), len(merged_class_names), merged_class_names,
        )

    config: dict = {"epochs": body.epochs, "batch_size": body.batch_size}
    if merged_class_names is not None:
        config["merged_class_names"] = merged_class_names
        config["dataset_remaps"] = dataset_remaps

    job = Job(
        dataset_id=ids[0],  # primary dataset for backwards compat
        dataset_ids=ids,
        model_type=body.model_type,
        model_name=body.model_name,
        config=config,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue VM lifecycle task
    from app.tasks.vm_tasks import launch_training_job
    task = launch_training_job.delay(job.id)
    job.celery_task_id = task.id
    db.commit()

    return _job_to_dict(job)


@router.get("/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return [_job_to_dict(j) for j in jobs]


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    return _job_to_dict(job)


# ── Metrics ────────────────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/metrics")
def get_metrics(job_id: int, db: Session = Depends(get_db)):
    metrics = (
        db.query(TrainingMetric)
        .filter(TrainingMetric.job_id == job_id)
        .order_by(TrainingMetric.epoch)
        .all()
    )
    return [
        {
            "epoch": m.epoch,
            "train_loss": m.train_loss,
            "val_loss": m.val_loss,
            "map50": m.map50,
            "map50_95": m.map50_95,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
        }
        for m in metrics
    ]


@router.post("/jobs/{job_id}/metrics", status_code=201)
def post_metric(job_id: int, body: MetricReport, db: Session = Depends(get_db)):
    """Called by VM2 after each training epoch."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")

    metric = TrainingMetric(
        job_id=job_id,
        epoch=body.epoch,
        train_loss=body.train_loss,
        val_loss=body.val_loss,
        map50=body.map50,
        map50_95=body.map50_95,
    )
    db.add(metric)
    db.commit()
    return {"ok": True}


@router.patch("/jobs/{job_id}")
def update_job_status(job_id: int, body: JobStatusUpdate, db: Session = Depends(get_db)):
    """Called by VM2 to update job status (completed / failed)."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")

    valid = ["pending", "provisioning", "training", "completed", "failed"]
    if body.status not in valid:
        raise HTTPException(400, f"Invalid status. Choose from: {valid}")

    job.status = body.status
    if body.error_message:
        job.error_message = body.error_message
    if body.status in ("completed", "failed"):
        job.end_time = datetime.utcnow()
    db.commit()
    return _job_to_dict(job)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _job_to_dict(job: Job) -> dict:
    duration_s = None
    if job.start_time and job.end_time:
        duration_s = int((job.end_time - job.start_time).total_seconds())

    return {
        "id": job.id,
        "dataset_id": job.dataset_id,
        "dataset_ids": job.dataset_ids or [job.dataset_id],
        "model_type": job.model_type,
        "model_name": job.model_name,
        "config": job.config,
        "status": job.status,
        "start_time": job.start_time.isoformat() if job.start_time else None,
        "end_time": job.end_time.isoformat() if job.end_time else None,
        "duration_s": duration_s,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }
