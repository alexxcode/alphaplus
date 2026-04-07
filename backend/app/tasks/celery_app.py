from celery import Celery
from celery.signals import after_setup_logger
from app.config import settings
from app.logging_config import setup_logging

celery_app = Celery(
    "alphaplus",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.dataset_extraction",
        "app.tasks.vm_tasks",
        "app.tasks.gdrive_import",
    ],
)


@after_setup_logger.connect
def _on_celery_setup_logger(**kwargs):
    setup_logging()

celery_app.conf.task_routes = {
    "app.tasks.dataset_extraction.*": {"queue": "dataset_extraction"},
    "app.tasks.gdrive_import.*":      {"queue": "dataset_extraction"},
    "app.tasks.vm_tasks.*":           {"queue": "vm_lifecycle"},
}

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
