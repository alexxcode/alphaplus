# Resumen de Metrología – AlphaPlus Bracket Inspection

**Fecha:** 2026-03-27  
**Servicio:** `/opt/expai/metrology/metrology_service.py`  
**Endpoint REST:** `http://localhost:8100/` (FastAPI + Uvicorn)  
**Aceleración GPU:** No (CPU puro, OpenCV)

---

## 1. Descripción del Servicio

El servicio de metrología mide geometría de brackets metálicos a partir de renders sintéticos Omniverse (1024×1024 RGBA, fondo negro). Extrae cuatro métricas por imagen:

| Métrica | Descripción |
|---------|-------------|
| `holes_detected` | Número de agujeros detectados via jerarquía de contornos (RETR_TREE) |
| `fold_angle_deg` | Ángulo de pliegue 2D estimado via líneas Hough |
| `convexity_ratio` | Ratio convexidad/área del contorno exterior |
| `piece_area_px` | Área del silhouette del bracket en píxeles |

**Veredicto:** Sistema SOFT-SCORE – CONFORME si ≥ 3 de 4 checks individuales pasan.

---

## 2. Latencia

Medido sobre 5 imágenes del dataset (CPU, sin GPU):

| Estadístico | Valor |
|-------------|-------|
| Media | 40.0 ms |
| Desv. estándar | 1.9 ms |
| Min | 36.8 ms |
| Max | 41.6 ms |

---

## 3. Resultados de Exactitud (dataset completo: 28 imágenes)

| Clase | Imágenes | Correctas | Accuracy |
|-------|----------|-----------|----------|
| CONFORME (class 0) | 18 | 18 | **100.0%** |
| NO_CONFORME (class 1) | 10 | 0 | **0.0%** |
| **TOTAL** | **28** | **18** | **64.3%** |

### Matriz de Confusión

|  | Pred. CONFORME | Pred. NO_CONFORME |
|--|----------------|-------------------|
| **GT CONFORME** | TN = 18 | FP = 0 |
| **GT NO_CONFORME** | FN = 10 | TP = 0 |

- **Precision (NOK):** N/A (0 predichos como NOK)  
- **Recall (NOK):** 0.00 – el servicio nunca emite veredicto NO_CONFORME en este dataset  
- **Especificidad (OK):** 100% – cero falsas alarmas

### Subconjunto Frontal (piece_area_px > 35 000 px²): 14 imágenes

| Clase | Imágenes | Correctas | Accuracy |
|-------|----------|-----------|----------|
| CONFORME | 9 | 9 | 100.0% |
| NO_CONFORME | 5 | 0 | 0.0% |
| **TOTAL** | **14** | **9** | **64.3%** |

El filtro frontal no mejora la detección de NOK: el problema no es el ángulo de cámara sino la superposición de distribuciones de features entre clases.

---

## 4. Estadísticas de Features por Clase

| Feature | Clase OK (n=18) | Clase NOK (n=10) |
|---------|-----------------|------------------|
| `fold_angle_deg` | 104.2 ± 14.9 °  (min 90, max 138) | 111.5 ± 19.8 °  (min 91, max 157) |
| `holes_detected` | 1.5 ± 1.8 | 1.4 ± 1.5 |
| `convexity_ratio` | 0.589 ± 0.297 | 0.635 ± 0.280 |

**Observación clave:** las distribuciones OK/NOK se solapan casi completamente para las tres métricas accesibles desde vistas 2D. El veredicto actual es equivalente a predecir siempre CONFORME.

---

## 5. Análisis de Limitaciones

### 5.1 Ambigüedad de perspectiva
Los renders Omniverse usan orientaciones de cámara aleatorias. Las métricas 2D (ángulo de pliegue, convexidad) dependen fuertemente del punto de vista y no capturan la geometría 3D real:
- `fold_angle_deg`: rango OK 90–138 °, rango NOK 91–157 ° → casi idéntico
- `convexity_ratio`: rango OK 0.11–0.99, rango NOK 0.27–0.96 → superpuesto

### 5.2 Visibilidad de agujeros
Los 4 agujeros del bracket son visibles como vacíos topológicos sólo cuando la cámara apunta perpendicularmente al plano de los agujeros. Media detectada: OK 1.5, NOK 1.4 – sin poder discriminatorio.

### 5.3 Score umbral insuficiente
El sistema SOFT-SCORE (≥3/4 checks) está calibrado sobre el conjunto de entrenamiento. Con features no discriminantes, todas las imágenes acaban con score ≥3 → veredicto siempre CONFORME.

### 5.4 Imagen rgb_0081 (outlier)
`fold_angle_deg = 157.0°` → único NOK detectado por el check de ángulo, pero el score total sigue siendo 2/4 (≥3 requerido para NOK), por lo que es clasificado CONFORME.

---

## 6. Proyección a Producción

Para despliegue real se recomienda:

| Aspecto | Recomendación |
|---------|---------------|
| Input | Vistas frontales controladas (cámara fija, ±10° tolerancia) o visión 3D multi-vista |
| Features | Añadir profundidad (ToF/stereo) o keypoints 3D para ángulo verdadero |
| Modelo | Reemplazar heurística por clasificador supervisado (SVM/CNN) entrenado con vistas calibradas |
| Umbral | Aumentar `min_passing_checks` a 4/4 con features mejores, o calibrar por ROC |
| Latencia | 40 ms/imagen CPU → aceptable para cadena de producción ≤25 piezas/s |
| Dataset | El set de 28 imágenes es insuficiente; mínimo recomendado: 200 por clase |

---

## 7. Archivos de Evidencia

| Archivo | Descripción |
|---------|-------------|
| `best_ok.png` | Bracket CONFORME con más agujeros detectados (rgb_0000, 5 holes) |
| `best_nok.png` | Bracket NO_CONFORME con más agujeros detectados |
| `nok_deformation.png` | Bracket NO_CONFORME con menor convexidad (rgb_0069, conv=0.267) |
| `comparison.png` | Comparativa 4-paneles: OK raw / OK medido / NOK raw / NOK medido |
| `batch_results.csv` | Resultados completos de las 28 imágenes |

---

*Generado automáticamente – AlphaPlus Metrology Service v1.0*
