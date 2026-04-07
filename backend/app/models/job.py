from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float, ForeignKey, CheckConstraint, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','provisioning','training','completed','failed')",
            name="ck_job_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)  # primary dataset (backwards compat)
    dataset_ids = Column(JSON, nullable=True)  # list of dataset IDs for multi-dataset training
    model_type = Column(String(20), nullable=False)   # yolov8n, yolov8s, yolo11n …
    model_name = Column(String(255), nullable=False)  # user-defined name for registry
    config = Column(JSON, nullable=True)              # {epochs, batch_size, lr, …}
    status = Column(String(20), nullable=False, default="pending")
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    celery_task_id = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="jobs")
    model_versions = relationship("ModelVersion", back_populates="job")
    metrics = relationship("TrainingMetric", back_populates="job")


class TrainingMetric(Base):
    __tablename__ = "training_metrics"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    epoch = Column(Integer, nullable=False)
    train_loss = Column(Float, nullable=True)
    val_loss = Column(Float, nullable=True)
    map50 = Column(Float, nullable=True)
    map50_95 = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="metrics")
