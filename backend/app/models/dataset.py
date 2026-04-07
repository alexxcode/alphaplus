from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Text, JSON, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = (
        CheckConstraint(
            "source IN ('mentat', 'manual', 'gdrive')",
            name="ck_dataset_source",
        ),
        CheckConstraint(
            "status IN ('pending_upload','uploading','extracting','validating','ready','failed','importing')",
            name="ck_dataset_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    gcs_path = Column(String(500), nullable=True)
    class_count = Column(Integer, nullable=True)
    image_count = Column(Integer, nullable=True)
    upload_date = Column(DateTime, default=datetime.utcnow)
    project_name = Column(String(255), nullable=True)

    # Source of the dataset
    source = Column(String(20), nullable=False, default="mentat")
    # Lifecycle status (manual uploads have all states; MENTAT imports are always "ready")
    status = Column(String(20), nullable=False, default="ready")
    progress_message = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)

    # Manual upload tracking
    upload_id = Column(String(36), unique=True, nullable=True, index=True)
    original_filename = Column(String(255), nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    celery_task_id = Column(String(255), nullable=True)

    # Google Drive import tracking
    gdrive_file_id = Column(String(255), nullable=True)

    # Class metadata
    class_names = Column(JSON, nullable=True)

    jobs = relationship("Job", back_populates="dataset")
