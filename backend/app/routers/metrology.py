"""
Metrología proxy endpoints:
  GET  /api/metrology/status  — comprueba si el servicio local (puerto 8100) está activo
  POST /api/metrology/predict — reenvía una imagen al servicio y devuelve las métricas
"""
import logging

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger(__name__)

import os
_SERVICE_URL = os.environ.get("METROLOGY_SERVICE_URL", "http://localhost:8100")
_TIMEOUT = 15.0


@router.get("/status")
async def metrology_status():
    """Comprueba si el servicio de metrología en localhost:8100 responde."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{_SERVICE_URL}/health")
            r.raise_for_status()
            return {"reachable": True, "detail": r.json()}
    except httpx.ConnectError:
        return {"reachable": False, "detail": "Connection refused — service not running on port 8100"}
    except Exception as exc:
        return {"reachable": False, "detail": str(exc)}


@router.post("/predict")
async def metrology_predict(file: UploadFile = File(...)):
    """
    Reenvía una imagen (PNG/JPG) al servicio de metrología y devuelve:
      holes_detected, fold_angle_deg, convexity_ratio, piece_area_px,
      pixel_to_mm, score, verdict, violations
    """
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Se requiere un archivo de imagen (PNG, JPG, etc.).")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Archivo vacío.")

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                f"{_SERVICE_URL}/predict",
                files={"file": (file.filename or "image.png", contents, file.content_type)},
            )
            if response.status_code == 404:
                # Fallback: some services use /measure or /inspect
                response = await client.post(
                    f"{_SERVICE_URL}/measure",
                    files={"file": (file.filename or "image.png", contents, file.content_type)},
                )
            response.raise_for_status()
            return JSONResponse(content=response.json())

    except httpx.ConnectError:
        raise HTTPException(503, "Servicio de metrología no disponible en localhost:8100. Comprueba que el servicio esté arrancado.")
    except httpx.TimeoutException:
        raise HTTPException(504, f"El servicio de metrología no respondió en {_TIMEOUT}s.")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(exc.response.status_code, f"Error del servicio de metrología: {exc.response.text}")
    except Exception as exc:
        logger.exception("Error inesperado llamando al servicio de metrología")
        raise HTTPException(500, str(exc))
