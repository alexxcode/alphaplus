# ALPHA PLUS — Industrial Model Training Platform

> **PRIVADO Y CONFIDENCIAL**
> Versión 0.1 — Marzo 2026 — Borrador de arquitectura

---

## Qué es

ALPHA PLUS es una plataforma web de entrenamiento, evaluación y despliegue de modelos YOLO para visión artificial industrial. Opera como sistema independiente a MENTAT, conectado a él únicamente a través de Google Cloud Storage.

```
MENTAT  ──exporta datasets──▶  GCS  ◀──lee──  ALPHA PLUS
                                 │
                                 └──escribe modelos──▶  GCS  ◀──sirve──  Inference API
```

---

## Ecosistema: estructura de GCS

```
gs://{bucket}/
├── temp-uploads/                          # ZIPs temporales de upload manual
│   └── {upload_uuid}/
│       └── upload.zip                     # eliminado tras extracción exitosa o fallida
│                                          # lifecycle rule: auto-borrar a los 7 días
│
├── datasets/
│   ├── {project_name}/                    # datasets exportados desde MENTAT
│   │   └── {timestamp}/
│   │       ├── data.yaml
│   │       ├── metadata.json          # clases, counts, fecha, source: "mentat"
│   │       ├── train/
│   │       │   ├── images/
│   │       │   └── labels/
│   │       └── val/
│   │           ├── images/
│   │           └── labels/
│   │
│   └── manual/                            # datasets subidos manualmente por el usuario
│       └── {upload_uuid}/
│           ├── data.yaml              # reescrito con rutas GCS canónicas
│           ├── metadata.json          # clases, counts, fecha, source: "manual", original_filename
│           ├── train/
│           │   ├── images/
│           │   └── labels/
│           └── val/
│               ├── images/
│               └── labels/
│
└── models/
    └── {model_name}/
        ├── v1/
        │   ├── best.pt
        │   ├── last.pt
        │   └── metrics.json           # mAP@50, precision, recall, speed
        ├── v2/
        │   └── ...
        └── production.json            # puntero a la versión activa
```

> **Nota sobre `data.yaml` en uploads manuales:** el ZIP original puede contener rutas relativas incompatibles con GCS. Durante la extracción, ALPHA PLUS regenera un `data.yaml` canónico con rutas absolutas GCS para que VM2 pueda consumir el dataset sin modificaciones:
> ```yaml
> path: "gs://{bucket}/datasets/manual/{upload_uuid}"
> train: "train/images"
> val:   "val/images"
> nc: 2
> names: ["glove", "hand"]
> ```

---

## Infraestructura — dos VMs en GCP

### VM 1 — App Server (siempre encendida)

| Parámetro | Valor |
|-----------|-------|
| Tipo | e2-standard-4 (o similar) |
| GPU | Ninguna |
| Coste estimado | ~$0.05–0.10 USD/hora |
| Rol | Frontend · API · BD · Orquestador de jobs |

Servicios (Docker Compose):
```
nginx       → reverse proxy :80
frontend    → React 18 + Vite
backend     → FastAPI (app logic, GCS client, VM lifecycle API)
worker      → Celery (orquesta arranque/parada de VM GPU)
db          → PostgreSQL (metadatos: modelos, jobs, métricas)
redis       → broker Celery
```

### VM 2 — Training Worker (apagada por defecto)

| Parámetro | Valor |
|-----------|-------|
| Tipo | n1-standard-8 + NVIDIA A100 (o A100 40GB) |
| GPU | A100 |
| Coste estimado | ~$3.00–4.00 USD/hora **solo mientras entrena** |
| Rol | Entrenamiento YOLO · Se apaga al terminar |

Flujo de vida de la VM GPU:
```
1. Usuario lanza job desde frontend
2. Celery worker (VM1) llama a GCP API → arranca VM2
3. VM2 ejecuta script de inicio:
     - Lee job config desde Redis / GCS
     - Descarga dataset desde GCS
     - Entrena YOLO (ultralytics)
     - Guarda best.pt + metrics.json en GCS
     - Actualiza estado del job en PostgreSQL (VM1)
     - SE APAGA SOLA (gcloud compute instances stop self)
4. Frontend detecta job completado → muestra métricas
```

---

## Módulos funcionales

### 1. Dataset Browser
- Dos pestañas: **MENTAT** (datasets exportados por MENTAT) y **Manual Upload** (datasets subidos directamente)
- Lista datasets con metadata: clases, distribución, número de imágenes, fecha, origen
- Muestra estado en tiempo real para uploads en curso: `pending_upload → extracting → validating → ready / failed`
- Botón **"+ Upload"** para subir un dataset en formato ZIP YOLO (ver flujo de upload abajo)
- Permite seleccionar cualquier dataset `ready` (de cualquier origen) como entrada para un job de entrenamiento

#### Flujo de upload manual (ZIP YOLO, hasta 20 GB)

Los datasets manuales nunca pasan por el backend para evitar timeouts. El flujo es:

```
Frontend                   Backend (FastAPI/VM1)           GCS                   Celery Worker
   │                               │                         │                         │
   │── POST /datasets/upload/init ──▶                        │                         │
   │◀── { dataset_id, gcs_resumable_url } ──────────────────┤                         │
   │                               │                         │                         │
   │── PUT (XHR directo, hasta 20GB) ──────────────────────▶ temp-uploads/{uuid}.zip  │
   │   (onprogress → barra de progreso en UI)                │                         │
   │                               │                         │                         │
   │── POST /datasets/upload/complete ──────────────────────▶│                         │
   │                               │── enqueue Celery task ─────────────────────────▶ │
   │                               │                         │                         │
   │── GET /datasets/{id}/status ──▶ (polling cada 5s)       │                         │
   │◀── { status: "extracting" / "validating" / "ready" } ──┤ ◀── upload final ───── │
   │                               │                         │      (temp ZIP borrado) │
```

**Validaciones en la tarea Celery:**
- Integridad del ZIP
- Estructura YOLO: `data.yaml`, `train/images/`, `train/labels/`, `val/images/`, `val/labels/`
- `data.yaml`: campos `nc` y `names` presentes y consistentes
- Labels (muestra 5%): formato `class_id x y w h`, `class_id < nc`, coords en `[0.0, 1.0]`
- Espacio disponible en disco antes de extraer (`required = zip_size * 5`)

### 2. Training Manager
- Configuración del job: modelo base (yolov8n/s/m/l/x), epochs, batch size, hiperparámetros
- Lanzamiento de entrenamiento con un clic
- Monitorización en tiempo real: loss curves, mAP por epoch (polling sobre GCS o BD)
- Historial completo de jobs con estado y duración

### 3. Model Registry
- Todas las versiones de cada modelo con métricas comparadas
- Tabla: versión · mAP@50 · precision · recall · velocidad (ms/img) · fecha
- Botón "Promover a producción" → actualiza `production.json` en GCS
- Descarga de `best.pt` por versión

### 4. Inference API
- El modelo en producción se sirve como endpoint REST en VM1
- `POST /predict` — body: imagen (base64 o multipart) → respuesta: detecciones con bboxes, clases y scores
- Recarga automática del modelo cuando cambia el puntero de producción en GCS
- Pensado para integración con EXPAI en producción

---

## Cambios requeridos en MENTAT

Mínimos y no disruptivos:

1. **Nuevo botón en exportación**: "Exportar a GCS" (el ZIP local existente no se modifica)
2. **Escritura en GCS**: el export genera la estructura `datasets/{project}/{timestamp}/` con `data.yaml` + `metadata.json`
3. **Credenciales**: variable de entorno `GOOGLE_APPLICATION_CREDENTIALS` apuntando a service account con permisos `storage.objectAdmin` sobre el bucket compartido

---

## Stack tecnológico previsto

| Capa | Tecnología |
|------|-----------|
| Framework web | FastAPI + Uvicorn |
| Frontend | React 18 + Vite |
| Entrenamiento | Ultralytics YOLOv8 / YOLO11 |
| Orquestación | Celery + Redis |
| Base de datos | PostgreSQL |
| Storage | Google Cloud Storage (`google-cloud-storage`) |
| Upload datasets | GCS Resumable Upload Sessions (upload directo frontend → GCS) |
| VM lifecycle | GCP Compute Engine API (`google-api-python-client`) |
| Contenedores | Docker + Docker Compose |
| Proxy | Nginx Alpine |

---

## Hoja de ruta de desarrollo

### Fase 1 — Infraestructura base
- [ ] Scaffold del proyecto (Docker Compose, estructura de directorios)
- [ ] Conexión a GCS: leer datasets, escribir modelos
- [ ] VM lifecycle: arrancar y apagar VM2 desde VM1 vía GCP API
- [ ] Job model en PostgreSQL + estado via polling
- [ ] Schema de BD con columnas de upload desde el inicio: `source`, `status`, `upload_id`, `original_filename`, `file_size_bytes`, `error_message`, `celery_task_id`, `class_names`
- [ ] Disco persistente dedicado (150GB) en VM1 para extracción de ZIPs, montado en `/data/extraction/`
- [ ] Lifecycle rule en GCS: borrar `temp-uploads/` después de 7 días

### Fase 2 — Entrenamiento y Dataset Browser
- [ ] Script de entrenamiento YOLO en VM2 con auto-apagado
- [ ] Dataset Browser en frontend (dos pestañas: MENTAT / Manual Upload)
- [ ] Training Manager con monitorización en tiempo real
- [ ] Guardado de métricas en GCS + BD
- [ ] Endpoints de upload: `POST /datasets/upload/init`, `POST /datasets/upload/complete`, `GET /datasets/{id}/status`
- [ ] Tarea Celery `extract_dataset_zip` (descarga, validación YOLO, extracción, upload a GCS, cleanup)
- [ ] Modal de upload en frontend con XHR, barra de progreso y polling de estado

### Fase 3 — Model Registry e Inference
- [ ] Model Registry con comparación de versiones
- [ ] Promoción a producción
- [ ] Inference API REST con recarga automática de modelo

### Fase 4 — Integración y pulido
- [ ] Modificación de MENTAT: botón "Exportar a GCS"
- [ ] Autenticación JWT compartida (mismo sistema que MENTAT)
- [ ] Alertas de coste (notificación si VM GPU lleva encendida más de N horas)
- [ ] Tests de integración MENTAT → GCS → ALPHA PLUS → Inference

---

## Notas para Claude Code

- La VM2 debe tener un **startup script** que lea el job pendiente y ejecute el entrenamiento sin intervención manual. El script debe terminar siempre con `gcloud compute instances stop $(hostname)` aunque haya error.
- El bucket GCS debe tener **lifecycle rules** para mover datasets antiguos a Nearline storage después de 90 días (reducción de coste).
- El puntero `production.json` debe ser atómico — usar **precondiciones de generación** (`if_generation_match`) en la librería `google-cloud-storage` para atomicidad real (GCS no tiene rename atómico).
- Considerar **Pub/Sub de GCS** como alternativa al polling para detectar cuando VM2 termina de escribir el modelo.
- **Upload manual de datasets:** usar `blob.create_resumable_upload_session()` con el parámetro `origin` para configurar CORS. El frontend sube directamente a GCS via XHR (no fetch) para acceder a `onprogress`. La cola Celery de extracción debe tener `concurrency=1` para evitar competencia por disco. La tarea debe hacer `shutil.disk_usage()` antes de extraer y fallar rápido si el espacio disponible es menor que `zip_size * 5`.
- **Datasets manuales en Training Manager:** cuando VM2 descargue el dataset, usará el `data.yaml` canonico generado durante la extracción. Las rutas son idénticas en estructura a los datasets de MENTAT, por lo que el script de entrenamiento no requiere cambios.

---

*ALPHA PLUS v0.1 — Borrador de arquitectura — Marzo 2026*
*Proyecto privado — No distribuir*
