sudo bash -c "mkdir -p /opt/alphaplus/metrology_service"

sudo bash -c "cat << 'EOF' > /opt/alphaplus/docker-compose.yml
version: '3.9'

# Shared backend config (DRY)
x-backend: &backend
  build:
    context: ./backend
    dockerfile: Dockerfile
  env_file: .env
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_healthy
  restart: unless-stopped

services:
  # ── Reverse proxy ─────────────────────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - \"80:80\"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  # ── Frontend (React 18 + Vite) ────────────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped

  # ── Metrology Service ──────────────────────────────────────────────────────────
  metrology:
    build:
      context: ./metrology_service
      dockerfile: Dockerfile
    ports:
      - \"8100:8100\"
    restart: unless-stopped

  # ── Backend API (FastAPI) ──────────────────────────────────────────────────────
  backend:
    <<: *backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      - METROLOGY_SERVICE_URL=http://metrology:8100
    volumes:
      - extraction_scratch:/data/extraction

  # ── Celery: dataset extraction (concurrency=1 → protege disco) ────────────────
  worker:
    <<: *backend
    command: celery -A app.tasks.celery_app worker -Q dataset_extraction --concurrency=1 -l info -n worker@%h
    volumes:
      - extraction_scratch:/data/extraction

  # ── Celery: VM lifecycle + tareas generales ────────────────────────────────────
  worker_vm:
    <<: *backend
    command: celery -A app.tasks.celery_app worker -Q vm_lifecycle,default --concurrency=4 -l info -n worker_vm@%h

  # ── PostgreSQL ─────────────────────────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-alphaplus}
      POSTGRES_USER: ${POSTGRES_USER:-alphaplus}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-alphaplus}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: [\"CMD-SHELL\", \"pg_isready -U ${POSTGRES_USER:-alphaplus}\"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Redis (broker Celery) ──────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    healthcheck:
      test: [\"CMD\", \"redis-cli\", \"ping\"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  extraction_scratch:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/disks/extraction
EOF"

sudo bash -c "cat << 'EOF' > /opt/alphaplus/backend/app/routers/metrology.py
\"\"\"
Metrología proxy endpoints:
  GET  /api/metrology/status  — comprueba si el servicio local (puerto 8100) está activo
  POST /api/metrology/predict — reenvía una imagen al servicio y devuelve las métricas
\"\"\"
import logging

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger(__name__)

import os
_SERVICE_URL = os.environ.get(\"METROLOGY_SERVICE_URL\", \"http://localhost:8100\")
_TIMEOUT = 15.0


@router.get(\"/status\")
async def metrology_status():
    \"\"\"Comprueba si el servicio de metrología en localhost:8100 responde.\"\"\"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f\"{_SERVICE_URL}/health\")
            r.raise_for_status()
            return {\"reachable\": True, \"detail\": r.json()}
    except httpx.ConnectError:
        return {\"reachable\": False, \"detail\": \"Connection refused — service not running on port 8100\"}
    except Exception as exc:
        return {\"reachable\": False, \"detail\": str(exc)}


@router.post(\"/predict\")
async def metrology_predict(file: UploadFile = File(...)):
    \"\"\"
    Reenvía una imagen (PNG/JPG) al servicio de metrología y devuelve:
      holes_detected, fold_angle_deg, convexity_ratio, piece_area_px,
      pixel_to_mm, score, verdict, violations
    \"\"\"
    if not (file.content_type or \"\").startswith(\"image/\"):
        raise HTTPException(400, \"Se requiere un archivo de imagen (PNG, JPG, etc.).\")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, \"Archivo vacío.\")

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f\"{_SERVICE_URL}/predict\",
                files={\"file\": (file.filename or \"image.png\", contents, file.content_type)},
            )
            if response.status_code == 404:
                # Fallback: some services use /measure or /inspect
                response = await client.post(
                    f\"{_SERVICE_URL}/measure\",
                    files={\"file\": (file.filename or \"image.png\", contents, file.content_type)},
                )
            response.raise_for_status()
            return JSONResponse(content=response.json())

    except httpx.ConnectError:
        raise HTTPException(503, \"Servicio de metrología no disponible en localhost:8100. Comprueba que el servicio esté arrancado.\")
    except httpx.TimeoutException:
        raise HTTPException(504, f\"El servicio de metrología no respondió en {_TIMEOUT}s.\")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, f\"Error del servicio de metrología: {exc.response.text}\")
    except Exception as exc:
        logger.exception(\"Error inesperado llamando al servicio de metrología\")
        raise HTTPException(500, str(exc))
EOF"

sudo bash -c "cat << 'EOF' > /opt/alphaplus/metrology_service/requirements.txt
fastapi==0.111.0
uvicorn==0.30.1
opencv-python-headless==4.10.0.84
python-multipart==0.0.9
numpy==1.26.4
EOF"

sudo bash -c "cat << 'EOF' > /opt/alphaplus/metrology_service/Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8100

CMD [\"uvicorn\", \"metrology_service:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8100\"]
EOF"

sudo bash -c "cat << 'EOF' > /opt/alphaplus/metrology_service/metrology_service.py
import io
import math
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title=\"AlphaPlus Metrology Service\")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[\"*\"],
    allow_credentials=True,
    allow_methods=[\"*\"],
    allow_headers=[\"*\"],
)

# -- Calibration & Tolerances (Adapted for new piece) --
REF_AREA_MM2 = 665.0
REF_FOLD_ANGLE = 90.0
FOLD_TOLERANCE = 40.0
MIN_CONVEXITY = 0.30
MAX_HOLE_DIAM_MM = 30.0  # Increased to allow elongated slots
MIN_PASSING = 3


def preprocess(image_bgr):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bw


def get_contours(bw):
    contours, hierarchy = cv2.findContours(
        bw, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )
    return contours, hierarchy


def count_holes(hierarchy):
    if hierarchy is None:
        return 0
    holes = 0
    for h in hierarchy[0]:
        parent = h[3]
        if parent >= 0:
            holes += 1
    return holes


def compute_avg_hole_diameter(contours, hierarchy):
    if hierarchy is None:
        return 0.0
    hole_areas = []
    for i, h in enumerate(hierarchy[0]):
        if h[3] >= 0:
            area = cv2.contourArea(contours[i])
            hole_areas.append(area)
    if not hole_areas:
        return 0.0
    avg_area = sum(hole_areas) / len(hole_areas)
    return 2.0 * math.sqrt(avg_area / math.pi)


def estimate_fold_angle(bw):
    edges = cv2.Canny(bw, 50, 150)
    lines = cv2.HoughLinesP(
        edges,
        rho=1, theta=np.pi / 180,
        threshold=50,
        minLineLength=30, maxLineGap=10
    )
    if lines is None:
        return 90.0

    angles = []
    for x1, y1, x2, y2 in lines[:, 0]:
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180
        angles.append(angle)

    angles_arr = np.array(angles)
    arr_under_90 = angles_arr[angles_arr < 90]
    arr_over_90 = angles_arr[angles_arr >= 90]

    a1 = np.median(arr_under_90) if len(arr_under_90) > 0 else np.nan
    a2 = np.median(arr_over_90) if len(arr_over_90) > 0 else np.nan

    if not (np.isnan(a1) or np.isnan(a2)):
        return float(abs(a2 - a1))
    return 90.0


def convexity_ratio(contour):
    area = cv2.contourArea(contour)
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    if hull_area == 0:
        return 0.0
    return float(area / hull_area)


@app.get(\"/\")
def read_root():
    return RedirectResponse(url=\"/docs\")

@app.get(\"/health\")
def health():
    return {\"status\": \"ok\", \"service\": \"metrology\"}


@app.post(\"/predict\")
@app.post(\"/measure\")
async def predict_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail=\"Invalid image file.\")

    bw = preprocess(image_bgr)
    contours, hierarchy = get_contours(bw)

    holes_detected = count_holes(hierarchy)
    fold_angle_deg = estimate_fold_angle(bw)
    
    piece_area_px = 0.0
    conv_ratio = 0.0
    if contours:
        main_contour = max(contours, key=cv2.contourArea)
        piece_area_px = float(cv2.contourArea(main_contour))
        if piece_area_px < 1.0:
            piece_area_px = float(cv2.countNonZero(bw))
        conv_ratio = convexity_ratio(main_contour)
    else:
        piece_area_px = float(cv2.countNonZero(bw))

    if piece_area_px <= 0:
        raise HTTPException(status_code=400, detail=\"Could not detect object in image.\")

    pixel_to_mm = math.sqrt(REF_AREA_MM2 / piece_area_px)

    checks = []
    violations = []

    if abs(fold_angle_deg - REF_FOLD_ANGLE) <= FOLD_TOLERANCE:
        checks.append(True)
    else:
        checks.append(False)
        violations.append(f\"fold_angle_{fold_angle_deg:.1f}deg outside {REF_FOLD_ANGLE}±{FOLD_TOLERANCE}deg\")

    if conv_ratio >= MIN_CONVEXITY:
        checks.append(True)
    else:
        checks.append(False)
        violations.append(f\"convexity_{conv_ratio:.3f}_lt_{MIN_CONVEXITY}\")

    if holes_detected >= 1:
        checks.append(True)
    else:
        checks.append(False)
        violations.append(\"no_holes_detected\")

    if holes_detected > 0:
        avg_diam_mm = compute_avg_hole_diameter(contours, hierarchy) * pixel_to_mm
        if avg_diam_mm <= MAX_HOLE_DIAM_MM:
            checks.append(True)
        else:
            checks.append(False)
            violations.append(f\"avg_hole_diam_{avg_diam_mm:.2f}mm > {MAX_HOLE_DIAM_MM}mm\")
    else:
        checks.append(True)

    score = sum(checks)
    verdict = \"CONFORME\" if score >= MIN_PASSING else \"NO_CONFORME\"

    return JSONResponse({
        \"holes_detected\": holes_detected,
        \"fold_angle_deg\": round(fold_angle_deg, 1),
        \"convexity_ratio\": round(conv_ratio, 4),
        \"piece_area_px\": piece_area_px,
        \"pixel_to_mm\": round(pixel_to_mm, 4),
        \"score\": score,
        \"verdict\": verdict,
        \"violations\": \"; \".join(violations)
    })
EOF"

sudo bash -c "cd /opt/alphaplus && docker compose up -d --build metrology backend"
