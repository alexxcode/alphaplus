"""
Centralized logging configuration for ALPHA PLUS backend.
"""
import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """Configure structured logging for the entire application."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove any existing handlers
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    root.addHandler(handler)

    # Quiet noisy third-party loggers
    for noisy in (
        "urllib3", "google.auth", "google.cloud", "google.api_core",
        "googleapiclient", "celery.utils", "celery.app.trace",
        "uvicorn.access", "httpcore", "httpx",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)
