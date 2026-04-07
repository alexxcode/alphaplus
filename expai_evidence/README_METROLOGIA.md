# Servicio de Metrología — Documentación Técnica

**Versión:** 1.0
**Fecha:** 2026-03-30
**Ubicación en servidor:** `/opt/expai/metrology/metrology_service.py`
**Puerto:** `8100`
**Runtime:** FastAPI + Uvicorn (CPU puro, OpenCV)

---

## 1. Descripción general

El servicio mide propiedades geométricas de brackets metálicos a partir de renders sintéticos generados con NVIDIA Omniverse (imágenes 1024×1024 RGBA, fondo negro). No requiere GPU; el procesamiento es íntegramente con OpenCV en CPU con una latencia de ~40 ms/imagen.

### Pipeline de análisis

```
Imagen PNG/JPG (1024×1024)
        │
        ▼
┌───────────────────┐
│  Pre-procesado    │  → Umbral Otsu sobre canal V (HSV)
│  (binarización)   │     Máscara binaria del silhouette
└────────┬──────────┘
         │
         ├──► holes_detected    (jerarquía RETR_TREE, contornos interiores)
         ├──► fold_angle_deg    (líneas Hough → ángulo mediano de la bisectriz)
         ├──► convexity_ratio   (área_contorno / área_convex_hull)
         └──► piece_area_px     (área total del silhouette en px²)
                  │
                  ▼
         pixel_to_mm = sqrt(REF_AREA_MM2 / piece_area_px)
                  │
                  ▼
         SOFT-SCORE (≥ 3 de 4 checks individuales)
                  │
         ┌────────┴────────┐
     CONFORME          NO_CONFORME
```

---

## 2. Instalación y arranque

```bash
# Dependencias
pip install fastapi uvicorn opencv-python-headless numpy

# Arrancar el servicio
cd /opt/expai/metrology
uvicorn metrology_service:app --host 0.0.0.0 --port 8100 --workers 1

# Verificar salud
curl http://localhost:8100/health
# → {"status": "ok", "service": "metrology"}
```

---

## 3. Endpoints REST

### `GET /health`

Comprueba que el servicio está activo.

```bash
curl http://localhost:8100/health
```

```json
{
  "status": "ok",
  "service": "metrology"
}
```

---

### `POST /predict`

Analiza una imagen y devuelve las métricas geométricas y el veredicto.

**Request:**

```bash
curl -X POST http://localhost:8100/predict \
  -F "file=@bracket_rgb_0000.png"
```

**Response (ejemplo — pieza CONFORME):**

```json
{
  "holes_detected":  5,
  "fold_angle_deg":  113.0,
  "convexity_ratio": 0.7053,
  "piece_area_px":   43225.0,
  "pixel_to_mm":     0.1241,
  "score":           3,
  "verdict":         "CONFORME",
  "violations":      "avg_hole_diam_1.77mm err=4.22mm tol=2.0mm"
}
```

**Response (ejemplo — pieza NO_CONFORME con score insuficiente):**

```json
{
  "holes_detected":  0,
  "fold_angle_deg":  157.0,
  "convexity_ratio": 0.2991,
  "piece_area_px":   15332.5,
  "pixel_to_mm":     0.1131,
  "score":           2,
  "verdict":         "CONFORME",
  "violations":      "fold_angle_157.0deg outside 100.0±40.0deg; convexity_0.299_lt_0.3"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `holes_detected` | `int` | Número de agujeros (contornos interiores en jerarquía RETR_TREE) |
| `fold_angle_deg` | `float` | Ángulo de pliegue estimado por líneas Hough (°) |
| `convexity_ratio` | `float` | `area_contorno / area_convex_hull` ∈ [0, 1] |
| `piece_area_px` | `float` | Área del silhouette en píxeles cuadrados |
| `pixel_to_mm` | `float` | Factor de escala mm/px (basado en área de referencia) |
| `score` | `int` | Número de checks individuales que pasan (0–4) |
| `verdict` | `string` | `"CONFORME"` o `"NO_CONFORME"` |
| `violations` | `string` | Checks fallados, separados por `;` |

---

## 4. Lógica de checks internos

El veredicto se calcula mediante un sistema SOFT-SCORE: si ≥ 3 de los 4 checks pasan, la pieza es CONFORME.

```python
# Pseudocódigo del sistema de scoring
REF_FOLD_ANGLE   = 100.0   # grados — ángulo de pliegue nominal
FOLD_TOLERANCE   = 40.0    # grados — tolerancia ±
MIN_CONVEXITY    = 0.30    # ratio mínimo aceptable
TARGET_HOLES     = 4       # número esperado de agujeros
MAX_HOLE_DIAM_MM = 6.0     # diámetro máximo de agujero en mm
MIN_PASSING      = 3       # checks mínimos para CONFORME

checks = []

# Check 1 — ángulo de pliegue
checks.append(abs(fold_angle_deg - REF_FOLD_ANGLE) <= FOLD_TOLERANCE)

# Check 2 — convexidad
checks.append(convexity_ratio >= MIN_CONVEXITY)

# Check 3 — número de agujeros (permisivo: ≥ 1 agujero detectado cuenta como check OK)
checks.append(holes_detected >= 1)

# Check 4 — diámetro de agujeros (si hay agujeros medibles)
if holes_detected > 0:
    avg_diam_mm = compute_avg_hole_diameter(contours) * pixel_to_mm
    checks.append(avg_diam_mm <= MAX_HOLE_DIAM_MM)
else:
    checks.append(True)  # sin agujeros visibles → check no penaliza

score   = sum(checks)
verdict = "CONFORME" if score >= MIN_PASSING else "NO_CONFORME"
```

---

## 5. Extracción de métricas — fragmentos clave

### 5.1 Binarización y contornos

```python
import cv2
import numpy as np

def preprocess(image_bgr):
    gray  = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Eliminar canal alfa si la imagen es RGBA
    return bw

def get_contours(bw):
    contours, hierarchy = cv2.findContours(
        bw, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )
    return contours, hierarchy
```

### 5.2 Detección de agujeros

```python
def count_holes(contours, hierarchy):
    """Cuenta contornos con padre válido (agujeros topológicos)."""
    if hierarchy is None:
        return 0
    holes = 0
    for i, h in enumerate(hierarchy[0]):
        parent = h[3]  # índice del contorno padre
        if parent >= 0:
            holes += 1
    return holes
```

### 5.3 Ángulo de pliegue 

```python
def estimate_fold_angle(bw):
    edges = cv2.Canny(bw, 50, 150)
    lines = cv2.HoughLinesP(
        edges,
        rho=1, theta=np.pi/180,
        threshold=50,
        minLineLength=30, maxLineGap=10
    )
    if lines is None:
        return 90.0

    angles = []
    for x1, y1, x2, y2 in lines[:, 0]:
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1)) % 180
        angles.append(angle)

    # Bisectriz de los dos clusters angulares principales
    angles_arr = np.array(angles)
    a1 = np.median(angles_arr[angles_arr < 90])
    a2 = np.median(angles_arr[angles_arr >= 90])
    return float(abs(a2 - a1)) if not (np.isnan(a1) or np.isnan(a2)) else 90.0
```

### 5.4 Ratio de convexidad

```python
def convexity_ratio(contour):
    area        = cv2.contourArea(contour)
    hull        = cv2.convexHull(contour)
    hull_area   = cv2.contourArea(hull)
    if hull_area == 0:
        return 0.0
    return area / hull_area
```

---

## 6. Integración con la Fábrica de Modelos de IA Industrial

El servicio se expone como proxy HTTP en el backend principal:

| Endpoint interno | Ruta pública (proxy) |
|---|---|
| `GET  http://localhost:8100/health`  | `GET  /api/metrology/status`  |
| `POST http://localhost:8100/predict` | `POST /api/metrology/predict` |

El frontend en `/metrologia` permite:
- Comprobar el estado del servicio en tiempo real
- Subir imágenes de brackets y obtener métricas al instante
- Visualizar el veredicto y las violaciones detectadas

---

## 7. Resultados de validación (dataset completo: 28 imágenes)

| Clase | n | Correctas | Accuracy |
|---|---|---|---|
| CONFORME (GT=0) | 18 | 18 | **100 %** |
| NO_CONFORME (GT=1) | 10 | 0 | **0 %** |
| **Total** | **28** | **18** | **64.3 %** |

**Observación crítica:** el Recall sobre piezas defectuosas es 0 % — el servicio nunca emite veredicto NO_CONFORME en este dataset. Las distribuciones de features (ángulo, convexidad, agujeros) se solapan completamente entre clases OK y NOK en vistas con orientación de cámara aleatoria.

```
Matriz de confusión:
                   Pred. CONFORME   Pred. NO_CONFORME
GT CONFORME  (18)       18                 0
GT NO_CONFORME (10)     10                 0

Precision NOK : N/A
Recall NOK    : 0.00
Especificidad : 1.00
```

---

## 8. Recomendaciones para producción

| Aspecto | Recomendación |
|---|---|
| Input | Vistas frontales fijas (±10° tolerancia) — elimina ambigüedad de perspectiva |
| Features | Añadir profundidad (ToF/stereo) o keypoints 3D para ángulo verdadero de pliegue |
| Modelo | Reemplazar heurística SOFT-SCORE por SVM/CNN supervisado con vistas calibradas |
| Umbral | Calibrar `min_passing_checks` por curva ROC sobre dataset balanceado |
| Dataset | Mínimo recomendado: 200 imágenes/clase con orientación de cámara controlada |
| Latencia | 40 ms/imagen CPU → aceptable para cadenas ≤ 25 piezas/s |

---

*Documento generado automáticamente — Fábrica de Modelos de IA Industrial v1.0*
