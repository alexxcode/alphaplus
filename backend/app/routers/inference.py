"""
Inference endpoints:
  GET  /api/inference/status          — is a production model loaded?
  POST /api/inference/predict         — run inference on image or video → JSON
  POST /api/inference/predict-annotated — run inference on video → annotated MP4
"""
import io
import logging
import tempfile
import time
from pathlib import Path
from typing import Optional

import cv2
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory model cache: avoids re-downloading/reloading on every request
_cached_model = None
_cached_model_key: Optional[str] = None  # "{model_name}/v{version}"

MODELS_CACHE_DIR = Path("/tmp/alphaplus_models")

_IMAGE_TYPES = {"image/jpeg", "image/png", "image/bmp", "image/webp", "image/tiff"}
_VIDEO_TYPES = {"video/mp4", "video/avi", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/webm"}
_VIDEO_EXTS  = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

# BGR colors per class (matching CVAT label colors)
_CLASS_COLORS: dict[str, tuple] = {
    "mano_con_guante":    (163,  66,  44),   # #2c42a3
    "mano_sin_guante":    ( 47, 212, 250),   # #fad42f
    "operario_activo":    (247, 193,  39),   # #27c1f7
    "operario_transicion":(111, 108, 111),   # #6f6c6f
}
_DEFAULT_COLOR = (0, 200, 0)

# Max output width for annotated video (downscale 4K → 1080p)
_OUT_WIDTH = 1920


def _get_production_info() -> Optional[dict]:
    """Read production model info from the database."""
    try:
        from app.database import SessionLocal
        from app.models.model_version import ModelVersion
        db = SessionLocal()
        try:
            prod = (
                db.query(ModelVersion)
                .filter(ModelVersion.is_production == True)  # noqa: E712
                .order_by(ModelVersion.created_at.desc())
                .first()
            )
            if prod:
                return {
                    "model_name": prod.model_name,
                    "version": prod.version,
                    "gcs_path": prod.gcs_path,
                }
        finally:
            db.close()
    except Exception as exc:
        logger.warning("Could not fetch production model: %s", exc)
    return None


def _load_model(gcs_path: str, model_name: str, version: int):
    """Download best.pt from GCS (if not cached) and return a loaded YOLO model."""
    global _cached_model, _cached_model_key

    cache_key = f"{model_name}/v{version}"
    if _cached_model is not None and _cached_model_key == cache_key:
        return _cached_model

    from google.cloud import storage
    from ultralytics import YOLO

    model_dir = MODELS_CACHE_DIR / model_name / f"v{version}"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "best.pt"

    if not model_path.exists():
        logger.info("Downloading model from GCS: %s/best.pt", gcs_path.rstrip("/"))
        client = storage.Client()
        bucket = client.bucket(settings.GCS_BUCKET)
        blob_path = gcs_path.rstrip("/") + "/best.pt"
        bucket.blob(blob_path).download_to_filename(str(model_path))
        logger.info("Model saved to %s", model_path)

    logger.info("Loading YOLO model from %s", model_path)
    model = YOLO(str(model_path))

    _cached_model = model
    _cached_model_key = cache_key
    logger.info("Model %s loaded. Classes: %s", cache_key, model.names)
    return model


def _is_video(file: UploadFile) -> bool:
    if file.content_type and file.content_type in _VIDEO_TYPES:
        return True
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext in _VIDEO_EXTS:
            return True
    return False


def _is_image(file: UploadFile) -> bool:
    if file.content_type and file.content_type in _IMAGE_TYPES:
        return True
    if file.content_type and file.content_type.startswith("image/"):
        return True
    return False


def _draw_detections(frame, results, model, scale: float = 1.0):
    """Draw bounding boxes + labels on a BGR frame in-place."""
    for result in results:
        for box in result.boxes:
            cls_id     = int(box.cls[0])
            class_name = model.names.get(cls_id, str(cls_id))
            conf       = float(box.conf[0])
            x1, y1, x2, y2 = [int(v * scale) for v in box.xyxy[0].tolist()]

            color = _CLASS_COLORS.get(class_name, _DEFAULT_COLOR)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            label = f"{class_name} {conf:.2f}"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(frame, (x1, y1 - lh - 8), (x1 + lw + 6, y1), color, -1)
            cv2.putText(frame, label, (x1 + 3, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)


# ── Status ─────────────────────────────────────────────────────────────────────

@router.get("/status")
def inference_status():
    prod = _get_production_info()
    if not prod:
        return {"has_production_model": False, "model_name": None, "version": None}
    return {
        "has_production_model": True,
        "model_name": prod["model_name"],
        "version": prod["version"],
    }


# ── Predict → JSON ─────────────────────────────────────────────────────────────

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Run YOLO inference on an uploaded image or video → JSON."""
    prod = _get_production_info()
    if not prod:
        raise HTTPException(503, "No production model available.")

    is_vid = _is_video(file)
    is_img = _is_image(file)
    if not is_vid and not is_img:
        raise HTTPException(400, "Only image or video files are accepted.")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Empty file.")

    try:
        model = _load_model(prod["gcs_path"], prod["model_name"], prod["version"])
    except Exception as exc:
        logger.exception("Failed to load model")
        raise HTTPException(500, f"Failed to load model: {exc}")

    if is_vid:
        return await _predict_video(model, contents, file.filename or "video.mp4", prod)
    return _predict_image(model, contents, prod)


# ── Predict → Annotated MP4 ────────────────────────────────────────────────────

@router.post("/predict-annotated")
async def predict_annotated(file: UploadFile = File(...)):
    """
    Run YOLO inference on an uploaded video and return an annotated MP4
    with bounding boxes and labels drawn on each sampled frame.
    """
    prod = _get_production_info()
    if not prod:
        raise HTTPException(503, "No production model available.")

    if not _is_video(file):
        raise HTTPException(400, "Only video files are accepted for annotated output.")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Empty file.")

    try:
        model = _load_model(prod["gcs_path"], prod["model_name"], prod["version"])
    except Exception as exc:
        logger.exception("Failed to load model")
        raise HTTPException(500, f"Failed to load model: {exc}")

    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    stem   = Path(file.filename or "video").stem

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
        tmp_in.write(contents)
        input_path = Path(tmp_in.name)

    output_path = input_path.with_name(input_path.stem + "_annotated.mp4")

    try:
        cap = cv2.VideoCapture(str(input_path))
        if not cap.isOpened():
            raise HTTPException(400, "Could not open video file.")

        fps          = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        orig_w       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Downscale 4K → max 1920 px wide
        scale   = min(1.0, _OUT_WIDTH / orig_w)
        out_w   = int(orig_w * scale)
        out_h   = int(orig_h * scale)

        # Sample at most 300 frames
        max_frames = 300
        step = max(1, total_frames // max_frames) if total_frames > max_frames else 1

        # Output FPS: play annotated frames at a comfortable pace
        out_fps = max(3.0, min(fps / step, 15.0))

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_path), fourcc, out_fps, (out_w, out_h))

        frame_idx   = 0
        frames_done = 0
        t0 = time.perf_counter()

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % step == 0:
                if scale < 1.0:
                    frame = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)

                rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = model(rgb, verbose=False, conf=0.15)

                _draw_detections(frame, results, model)

                # Timestamp + model overlay
                ts_text = f"t={frame_idx/fps:.1f}s  frame {frame_idx}/{total_frames}"
                cv2.putText(frame, ts_text,
                            (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 3, cv2.LINE_AA)
                cv2.putText(frame, ts_text,
                            (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1, cv2.LINE_AA)

                model_label = f"{prod['model_name']} v{prod['version']}"
                cv2.putText(frame, model_label,
                            (12, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 3, cv2.LINE_AA)
                cv2.putText(frame, model_label,
                            (12, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)

                writer.write(frame)
                frames_done += 1

            frame_idx += 1

        cap.release()
        writer.release()
        elapsed = round((time.perf_counter() - t0) * 1000)
        logger.info("Annotated video: %d frames in %d ms → %s", frames_done, elapsed, output_path)

        # Read into memory so we can clean up the temp files
        video_bytes = output_path.read_bytes()

        download_name = f"{stem}_annotated.mp4"
        return Response(
            content=video_bytes,
            media_type="video/mp4",
            headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
        )

    finally:
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _predict_image(model, contents: bytes, prod: dict) -> dict:
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    t0 = time.perf_counter()
    results = model(image, verbose=False, conf=0.25)
    inference_ms = round((time.perf_counter() - t0) * 1000, 2)
    detections = _extract_detections(results, model)
    logger.info("Image inference %s: %d detections in %.1f ms", prod["model_name"], len(detections), inference_ms)
    return {
        "type": "image",
        "model_name": prod["model_name"],
        "model_version": prod["version"],
        "inference_time_ms": inference_ms,
        "detections": detections,
    }


async def _predict_video(model, contents: bytes, filename: str, prod: dict) -> dict:
    suffix = Path(filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(400, "Could not open video file.")

        fps          = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        max_frames = 300
        step = max(1, total_frames // max_frames) if total_frames > max_frames else 1

        frames_results = []
        frame_idx = 0
        t0 = time.perf_counter()

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step == 0:
                rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = model(rgb, verbose=False, conf=0.15)
                frames_results.append({
                    "frame":       frame_idx,
                    "timestamp_s": round(frame_idx / fps, 3),
                    "detections":  _extract_detections(results, model),
                })
            frame_idx += 1

        total_ms = round((time.perf_counter() - t0) * 1000, 2)
        cap.release()

        all_detections  = [d for fr in frames_results for d in fr["detections"]]
        unique_classes  = sorted(set(d["class_name"] for d in all_detections))

        logger.info("Video inference %s: %d frames, %d detections in %.1f ms",
                    prod["model_name"], len(frames_results), len(all_detections), total_ms)

        return {
            "type": "video",
            "model_name":     prod["model_name"],
            "model_version":  prod["version"],
            "inference_time_ms": total_ms,
            "video_info": {
                "fps":             round(fps, 2),
                "total_frames":    total_frames,
                "frames_processed": len(frames_results),
                "width":  width,
                "height": height,
                "duration_s": round(total_frames / fps, 2) if fps > 0 else 0,
            },
            "summary": {
                "total_detections": len(all_detections),
                "unique_classes":   unique_classes,
            },
            "frames": frames_results,
            "note": (f"Sampled 1 every {step} frames ({len(frames_results)} of {total_frames} total frames)."
                     if step > 1 else None),
        }

    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _extract_detections(results, model) -> list[dict]:
    detections = []
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "class_id":   cls_id,
                "class_name": model.names.get(cls_id, str(cls_id)),
                "confidence": round(float(box.conf[0]), 4),
                "bbox": {
                    "x1": round(x1, 1), "y1": round(y1, 1),
                    "x2": round(x2, 1), "y2": round(y2, 1),
                },
            })
    return detections
