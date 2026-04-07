import io
import math
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AlphaPlus Metrology Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def read_root():
    return RedirectResponse(url="/docs")

@app.get("/health")
def health():
    return {"status": "ok", "service": "metrology"}


@app.post("/predict")
@app.post("/measure")
async def predict_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    bw = preprocess(image_bgr)
    contours, hierarchy = get_contours(bw)

    holes_detected = count_holes(hierarchy)
    fold_angle_deg = estimate_fold_angle(bw)
    
    # Encontrar el contorno más grande (que asumimos es el silhouette general)
    piece_area_px = 0.0
    conv_ratio = 0.0
    if contours:
        main_contour = max(contours, key=cv2.contourArea)
        piece_area_px = float(cv2.contourArea(main_contour))
        if piece_area_px < 1.0:
            piece_area_px = float(cv2.countNonZero(bw))  # fallback
        conv_ratio = convexity_ratio(main_contour)
    else:
        piece_area_px = float(cv2.countNonZero(bw))

    if piece_area_px <= 0:
        raise HTTPException(status_code=400, detail="Could not detect object in image.")

    pixel_to_mm = math.sqrt(REF_AREA_MM2 / piece_area_px)

    checks = []
    violations = []

    # Check 1: Angulo
    if abs(fold_angle_deg - REF_FOLD_ANGLE) <= FOLD_TOLERANCE:
        checks.append(True)
    else:
        checks.append(False)
        violations.append(f"fold_angle_{fold_angle_deg:.1f}deg outside {REF_FOLD_ANGLE}±{FOLD_TOLERANCE}deg")

    # Check 2: Convexidad
    if conv_ratio >= MIN_CONVEXITY:
        checks.append(True)
    else:
        checks.append(False)
        violations.append(f"convexity_{conv_ratio:.3f}_lt_{MIN_CONVEXITY}")

    # Check 3: Agujeros
    if holes_detected >= 1:
        checks.append(True)
    else:
        checks.append(False)
        violations.append("no_holes_detected")

    # Check 4: Diametro de agujeros (adaptado a piezas multi-slot)
    if holes_detected > 0:
        avg_diam_mm = compute_avg_hole_diameter(contours, hierarchy) * pixel_to_mm
        if avg_diam_mm <= MAX_HOLE_DIAM_MM:
            checks.append(True)
        else:
            checks.append(False)
            violations.append(f"avg_hole_diam_{avg_diam_mm:.2f}mm > {MAX_HOLE_DIAM_MM}mm")
    else:
        checks.append(True)

    score = sum(checks)
    verdict = "CONFORME" if score >= MIN_PASSING else "NO_CONFORME"

    return JSONResponse({
        "holes_detected": holes_detected,
        "fold_angle_deg": round(fold_angle_deg, 1),
        "convexity_ratio": round(conv_ratio, 4),
        "piece_area_px": piece_area_px,
        "pixel_to_mm": round(pixel_to_mm, 4),
        "score": score,
        "verdict": verdict,
        "violations": "; ".join(violations)
    })

