from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import setup_logging
from app.database import engine, Base

setup_logging()

# Import models so SQLAlchemy knows about them before create_all
from app.models import Dataset, Job, TrainingMetric, ModelVersion  # noqa: F401

from app.routers import datasets, training, models_router, inference, metrology

# Create all tables on startup (use Alembic migrations in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ALPHA PLUS API",
    description="Industrial YOLO model training, evaluation and deployment platform.",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router,      prefix="/api/datasets",  tags=["datasets"])
app.include_router(training.router,      prefix="/api/training",  tags=["training"])
app.include_router(models_router.router, prefix="/api/models",    tags=["models"])
app.include_router(inference.router,     prefix="/api/inference",   tags=["inference"])
app.include_router(metrology.router,     prefix="/api/metrology",   tags=["metrology"])


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "alphaplus-backend", "version": "0.1.0"}
