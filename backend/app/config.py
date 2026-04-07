from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://alphaplus:alphaplus@db:5432/alphaplus"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Google Cloud Storage
    GCS_BUCKET: str = ""
    GCS_PROJECT: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # GCP Compute Engine
    GCP_PROJECT: str = ""
    GCP_ZONE: str = "us-central1-a"
    GPU_VM_NAME: str = "alphaplus-trainer"
    # Internal IP of VM1 (app server) — reachable from VM2 via port 80 (nginx)
    APP_VM_INTERNAL_IP: str = "10.128.0.2"

    # CORS & security
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Upload limits (bytes)
    MAX_UPLOAD_SIZE_BYTES: int = 21_474_836_480  # 20 GB
    MIN_UPLOAD_SIZE_BYTES: int = 10_485_760       # 10 MB

    # Extraction scratch disk
    EXTRACTION_PATH: str = "/data/extraction"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
