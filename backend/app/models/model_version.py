from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    model_name = Column(String(255), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    gcs_path = Column(String(500), nullable=True)  # gs://bucket/models/{name}/v{version}/

    # Training metrics
    map50 = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    speed_ms = Column(Float, nullable=True)

    is_production = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="model_versions")
