# Fábrica de Modelos de IA Industrial

> **PRIVADO Y CONFIDENCIAL**
> Versión 1.0 — Marzo 2026

---

## Descripción general

La **Fábrica de Modelos de IA Industrial** es una plataforma web de entrenamiento, evaluación y despliegue de modelos de visión artificial para entornos industriales. El sistema opera como una factoría de modelos completamente automatizada: recibe datasets etiquetados en formato YOLO, los valida, los normaliza, ejecuta ciclos de entrenamiento en GPU en la nube y publica los modelos resultantes como endpoints de inferencia REST listos para producción.

La plataforma se integra de forma nativa con **MENTAT** (plataforma de etiquetado de datos del ecosistema EXPAI), compartiendo con ella un bucket de Google Cloud Storage como única superficie de acoplamiento. Este diseño garantiza independencia de despliegue entre ambas plataformas manteniendo un flujo de datos continuo y auditable.

```
MENTAT  ──exporta datasets──▶  GCS  ◀──lee──  Fábrica de Modelos
                                 │
                                 └──escribe artefactos──▶  GCS  ◀──sirve──  Inference API
```

---

## Contexto de proyecto: EXPAI SmartIndustry (EUREKA 21028)

Esta plataforma forma parte del proyecto de I+D europeo **EXPAI SmartIndustry**, financiado en el marco del programa EUREKA (referencia 21028). El objetivo del proyecto es el desarrollo de una suite de herramientas de inteligencia artificial interpretable orientadas a procesos de inspección industrial: detección de defectos, monitorización de equipos y control de calidad visual.

La Fábrica de Modelos es el componente responsable del ciclo de vida completo del modelo de IA: desde la recepción del dataset hasta la disponibilidad del modelo entrenado en producción.

---

## Arquitectura de infraestructura — Dos VMs en GCP

El sistema se despliega sobre dos máquinas virtuales en Google Cloud Platform, siguiendo un modelo de separación de responsabilidades que minimiza el coste operativo.

### VM1 — Servidor de aplicación (siempre activa)

| Parámetro       | Valor                                      |
|-----------------|--------------------------------------------|
| Tipo de máquina | e2-standard-4 (4 vCPU, 16 GB RAM)         |
| GPU             | Ninguna                                    |
| Coste estimado  | ~$0.05–0.10 USD/hora                       |
| Rol             | Frontend · API REST · Base de datos · Orquestación de jobs |

Servicios gestionados mediante Docker Compose (7 contenedores):

```
nginx         → Reverse proxy en puerto 80; enruta /api/ al backend y / al frontend
frontend      → Aplicación React 18 + Vite (interfaz de usuario)
backend       → FastAPI + Uvicorn (lógica de negocio, cliente GCS, API del ciclo de vida VM)
worker        → Celery worker (pool: dataset_extraction, concurrencia=1)
worker_vm     → Celery worker (pool: vm_lifecycle, concurrencia=4)
db            → PostgreSQL 16-alpine (metadatos de datasets, jobs y métricas)
redis         → Redis 7-alpine (broker y backend de resultados de Celery)
```

### VM2 — Worker de entrenamiento GPU (apagada por defecto)

| Parámetro       | Valor                                          |
|-----------------|------------------------------------------------|
| Tipo de máquina | n1-standard-8 (8 vCPU, 30 GB RAM)            |
| GPU             | NVIDIA A100 40 GB                              |
| Coste estimado  | ~$3.00–4.00 USD/hora **solo durante el entrenamiento** |
| Rol             | Entrenamiento YOLO · Reporte de métricas · Auto-apagado garantizado |

VM2 no tiene servicios permanentes. Se aprovisiona bajo demanda, ejecuta un script de inicio (`startup.sh`) que descarga el worker de entrenamiento de GCS, instala las dependencias Python necesarias y lanza el proceso de entrenamiento. Al finalizar — con éxito o con error — VM2 se apaga de forma autónoma mediante `gcloud compute instances stop $(hostname)`, garantizando la ausencia de costes residuales.

---

## Estructura canónica de Google Cloud Storage

Todo el estado persistente del sistema (datasets, artefactos de modelos, configuraciones de jobs y logs) reside en un único bucket de GCS con la siguiente estructura:

```
gs://{bucket}/
├── temp-uploads/                            # ZIPs temporales de uploads manuales
│   └── {upload_uuid}/
│       └── upload.zip                       # Eliminado tras extracción exitosa o fallida
│                                            # Lifecycle rule: auto-borrar a los 7 días
│
├── datasets/
│   ├── {project_name}/                      # Datasets exportados desde MENTAT
│   │   └── {timestamp}/
│   │       ├── data.yaml                    # Rutas GCS canónicas
│   │       ├── metadata.json                # Clases, counts, fecha, source: "mentat"
│   │       ├── train/
│   │       │   ├── images/
│   │       │   └── labels/
│   │       └── val/
│   │           ├── images/
│   │           └── labels/
│   │
│   └── manual/                              # Datasets subidos manualmente
│       └── {upload_uuid}/
│           ├── data.yaml                    # Regenerado con rutas GCS canónicas
│           ├── metadata.json                # source: "manual", original_filename, layout
│           ├── train/
│           │   ├── images/
│           │   └── labels/
│           └── val/
│               ├── images/
│               └── labels/
│
├── jobs/
│   └── pending/
│       └── {job_id}/
│           └── config.json                  # Configuración del job (modelo, dataset, hiperparámetros)
│
├── models/
│   └── {model_name}/
│       ├── v1/
│       │   ├── best.pt                      # Pesos del mejor checkpoint (val mAP)
│       │   ├── last.pt                      # Pesos del último checkpoint
│       │   └── metrics.json                 # mAP@50, mAP@50-95, precision, recall, speed
│       ├── v2/
│       │   └── ...
│       └── production.json                  # Puntero atómico a la versión activa
│
└── logs/
    └── job-{job_id}-error.txt               # Trazas de error de VM2 (cuando aplica)
```

**Nota sobre `data.yaml` canónico:** el ZIP original puede contener rutas relativas incompatibles con GCS. Durante la extracción, el sistema regenera un `data.yaml` con rutas absolutas GCS:

```yaml
path: "gs://{bucket}/datasets/manual/{upload_uuid}"
train: "train/images"
val:   "val/images"
nc: 2
names: ["glove", "hand"]
```

**Nota sobre `production.json`:** la promoción de un modelo a producción es una operación atómica implementada con precondiciones de generación GCS (`if_generation_match`). Esto previene condiciones de carrera en entornos multi-usuario sin necesidad de bloqueos distribuidos.

---

## Módulos funcionales

### 1. Dataset Browser

Interfaz central para la gestión de datasets. Presenta dos pestañas diferenciadas:

- **MENTAT**: datasets exportados desde la plataforma de etiquetado. Se listan automáticamente al descubrir la estructura `gs://bucket/datasets/{project}/{timestamp}/` en GCS.
- **Manual Upload**: datasets subidos directamente por el usuario en formato ZIP YOLO.

Cada dataset muestra: nombre del proyecto, origen (`mentat` / `manual`), número de clases, nombres de clases, número de imágenes totales (train + val) y estado de procesamiento.

**Estados del ciclo de vida de un dataset:**

```
pending_upload → extracting → validating → ready
                                         ↘ failed (con mensaje de error)
```

#### Flujo de upload manual (hasta 20 GB)

Los datasets manuales nunca atraviesan el backend para evitar timeouts en transferencias de archivos grandes. El flujo utiliza **GCS Resumable Upload Sessions**:

```
Frontend                   Backend (FastAPI/VM1)           GCS                   Celery Worker
   │                               │                         │                         │
   │── POST /api/datasets/upload/init ──▶                    │                         │
   │◀── { dataset_id, gcs_resumable_url } ──────────────────┤                         │
   │                               │                         │                         │
   │── PUT (XHR directo, hasta 20 GB) ────────────────────▶ temp-uploads/{uuid}.zip  │
   │   (onprogress → barra de progreso en la UI)             │                         │
   │                               │                         │                         │
   │── POST /api/datasets/upload/complete ───────────────────▶│                         │
   │                               │── enqueue Celery task ─────────────────────────▶ │
   │                               │                         │                         │
   │── GET /api/datasets/{id}/status (polling cada 5 s) ─────▶│                         │
   │◀── { status: "extracting" / "validating" / "ready" } ──┤ ◀── upload final ───── │
   │                               │                         │      (ZIP temporal borrado) │
```

### 2. Tarea Celery: Extracción y Validación de Dataset

La tarea `extract_dataset_zip` (pool `dataset_extraction`, concurrencia=1) ejecuta el siguiente pipeline de 12 pasos:

1. **Comprobación de espacio en disco** — verifica que el espacio libre sea ≥ `zip_size × 5` antes de extraer.
2. **Descarga del ZIP** — descarga `temp-uploads/{upload_id}/upload.zip` desde GCS al disco persistente de VM1 (`/data/extraction/`).
3. **Validación de integridad ZIP** — ejecuta `zf.testzip()` para detectar corrupción.
4. **Detección de layout** — analiza el `namelist` del ZIP (sin extraer) para identificar la estructura:
   - **Split** (`train/images/ + val/images/`): estructura estándar YOLO, sin transformación.
   - **Nested** (`images/train/ + labels/train/`): árbol paralelo de imágenes y etiquetas.
   - **Flat** (`images/ + labels/`): pool único sin división train/val.
5. **Extracción** al disco local (`/data/extraction/{upload_id}/extracted/`).
6. **Normalización de layout**:
   - *Nested* → restructuración en-lugar a formato split.
   - *Flat* → auto-split 80/20 con semilla fija (`random.Random(42)`), conservando las parejas imagen-etiqueta.
7. **Parseo de `data.yaml`** — validación de campos `nc` y `names` (presencia y consistencia).
8. **Validación de etiquetas por muestreo** — inspecciona el 5% de los archivos `.txt` de `train/labels/` (mínimo 10 archivos). Verifica: 5 campos por línea, `class_id < nc`, coordenadas en `[0.0, 1.0]`.
9. **Generación de `data.yaml` canónico** — reescribe el archivo con rutas absolutas GCS.
10. **Generación de `metadata.json`** — registra `source`, `original_filename`, `upload_id`, `original_layout`, `class_count`, `class_names`, `image_count`, `train_count`, `val_count`, `date`.
11. **Upload a GCS** — sube el directorio extraído a `datasets/manual/{upload_id}/` usando un `ThreadPoolExecutor` de 16 workers para paralelizar la subida de ficheros.
12. **Actualización del registro en BD** — estado `ready` con metadatos completos; limpieza del directorio local y del ZIP temporal en GCS.

### 3. Training Manager

Panel de configuración y monitorización de jobs de entrenamiento:

- Selector de dataset (`ready`) como entrada.
- Selección de modelo base: familia YOLOv8 / YOLO11 (variantes nano, small, medium, large, xlarge).
- Configuración de hiperparámetros: epochs, batch size (valor -1 para auto-batch).
- Historial de jobs con estado (`pending / provisioning / training / completed / failed`), duración y métricas finales.
- Curvas en tiempo real de loss (train/val) y mAP por epoch mediante polling de la tabla `training_metrics`.

### 4. Ciclo de vida de VM2: Tarea Celery `launch_training_job`

La tarea `launch_training_job` (pool `vm_lifecycle`) gestiona el ciclo de vida completo del job de entrenamiento en VM2:

1. **Escritura de configuración en GCS** — publica `jobs/pending/{job_id}/config.json` con dataset path, tipo de modelo, nombre de modelo y URL del backend.
2. **Configuración de metadatos de VM** — establece el atributo `alphaplus-job-id` en la instancia GCP para que el script de inicio de VM2 sepa qué job ejecutar.
3. **Arranque de VM2** — invoca la GCP Compute Engine API para iniciar la instancia GPU.
4. **Periodo de gracia (45 s)** — espera antes del primer polling para absorber la latencia de transición GCP `TERMINATED → STAGING`.
5. **Polling de arranque** (timeout: 10 min) — verifica el estado `STAGING → PROVISIONING → RUNNING`.
6. **Marcado de job como `training`**.
7. **Polling de terminación** (timeout: 4 h) — espera la auto-terminación de VM2 o una actualización de estado vía API.
8. **Verificación de resultado** — si VM2 se terminó sin actualizar el estado del job, comprueba la existencia de `models/{model_name}/v1/best.pt` en GCS como indicador de éxito.

### 5. Worker de entrenamiento (VM2)

El script `train_worker.py` se descarga en VM2 durante el arranque y ejecuta:

1. **Lectura de configuración** desde `gs://bucket/jobs/pending/{job_id}/config.json`.
2. **Descarga del dataset** completo desde GCS a `/tmp/dataset/`.
3. **Reescritura de `data.yaml`** con rutas absolutas locales (sustituye rutas GCS por `/tmp/dataset/`).
4. **Entrenamiento YOLO** (`ultralytics.YOLO.train()`):
   - Callback `on_fit_epoch_end` — reporta métricas por epoch a `POST /api/training/jobs/{id}/metrics` en VM1.
5. **Upload de artefactos** — sube `best.pt`, `last.pt` y `metrics.json` a `gs://bucket/models/{model_name}/v{version}/`.
6. **Registro de versión** — llama a `POST /api/models` en VM1 con métricas finales.
7. **Actualización de estado del job** — `PATCH /api/training/jobs/{id}` con `status: completed`.
8. **Auto-apagado garantizado** — `os.system("gcloud compute instances stop $(hostname) --zone={ZONE}")` en el bloque `finally`.

En caso de error, sube la traza completa a `gs://bucket/logs/job-{job_id}-error.txt` antes de apagarse.

### 6. Model Registry

Catálogo de todas las versiones de modelos entrenados:

- Tabla comparativa: versión, mAP@50, mAP@50-95, precision, recall, velocidad (ms/imagen), fecha de creación.
- Descarga de pesos (`best.pt`) por versión.
- **Promoción a producción**: operación atómica que actualiza `production.json` en GCS con precondición de generación (`if_generation_match`), garantizando consistencia incluso con múltiples usuarios concurrentes.

### 7. Inference API

Endpoint REST de inferencia sobre el modelo en producción:

- `GET /api/inference/status` — verifica que el modelo de producción esté cargado.
- `POST /api/inference/predict` — recibe imagen (base64 o multipart/form-data) y devuelve detecciones con bounding boxes, clases y scores de confianza.
- **Carga perezosa** (`lazy load`): el modelo se descarga de GCS en la primera inferencia y se cachea en memoria, indexado por `(model_name, version)`.
- **Recarga automática**: el sistema detecta cambios en `production.json` y recarga el modelo sin necesidad de reiniciar el servicio.

---

## Modelo de datos (PostgreSQL)

### Tabla `datasets`

| Campo             | Tipo      | Descripción                                                         |
|-------------------|-----------|---------------------------------------------------------------------|
| id                | INTEGER PK | Identificador único                                                |
| gcs_path          | TEXT      | Ruta GCS canónica del dataset (`datasets/manual/{uuid}/`)          |
| class_count       | INTEGER   | Número de clases                                                    |
| image_count       | INTEGER   | Total de imágenes (train + val)                                     |
| upload_date       | TIMESTAMP | Fecha de subida                                                     |
| project_name      | TEXT      | Nombre del proyecto (MENTAT) o nombre del archivo (manual)         |
| source            | TEXT      | `mentat` o `manual`                                                 |
| status            | TEXT      | `pending_upload / extracting / validating / ready / failed`        |
| class_names       | JSON      | Lista de nombres de clases                                          |
| celery_task_id    | TEXT      | ID de la tarea Celery activa                                        |
| original_filename | TEXT      | Nombre del archivo ZIP original                                     |
| file_size_bytes   | BIGINT    | Tamaño del ZIP en bytes                                             |
| error_message     | TEXT      | Mensaje de error (si aplica)                                        |
| progress_message  | TEXT      | Mensaje de progreso en tiempo real                                  |

### Tabla `jobs`

| Campo          | Tipo      | Descripción                                                     |
|----------------|-----------|-----------------------------------------------------------------|
| id             | INTEGER PK | Identificador único                                            |
| dataset_id     | INTEGER FK | Referencia al dataset de entrada                               |
| model_type     | TEXT      | Tipo de modelo base (p. ej. `yolov8n`, `yolo11m`)              |
| model_name     | TEXT      | Nombre asignado al modelo entrenado                             |
| config         | JSON      | Hiperparámetros: `{epochs, batch_size}`                        |
| status         | TEXT      | `pending / provisioning / training / completed / failed`       |
| start_time     | TIMESTAMP | Inicio del entrenamiento en VM2                                 |
| end_time       | TIMESTAMP | Fin del entrenamiento                                           |
| celery_task_id | TEXT      | ID de la tarea Celery de lifecycle                              |
| error_message  | TEXT      | Descripción del error (si aplica)                               |

### Tabla `training_metrics`

| Campo      | Tipo      | Descripción                        |
|------------|-----------|------------------------------------|
| id         | INTEGER PK | Identificador único               |
| job_id     | INTEGER FK | Referencia al job de entrenamiento |
| epoch      | INTEGER   | Número de epoch                    |
| train_loss | FLOAT     | Pérdida de entrenamiento (box loss)|
| val_loss   | FLOAT     | Pérdida de validación (box loss)   |
| map50      | FLOAT     | mAP@IoU=0.50                       |
| map50_95   | FLOAT     | mAP@IoU=0.50:0.95                  |
| timestamp  | TIMESTAMP | Momento del registro               |

### Tabla `model_versions`

| Campo        | Tipo      | Descripción                                            |
|--------------|-----------|--------------------------------------------------------|
| id           | INTEGER PK | Identificador único                                   |
| job_id       | INTEGER FK | Job que generó esta versión                           |
| model_name   | TEXT      | Nombre del modelo                                      |
| version      | INTEGER   | Número de versión (incremento automático)              |
| gcs_path     | TEXT      | Ruta GCS de los artefactos (`models/{name}/v{n}/`)    |
| map50        | FLOAT     | mAP@IoU=0.50 del mejor checkpoint                     |
| precision    | FLOAT     | Precisión                                              |
| recall       | FLOAT     | Recall                                                 |
| speed_ms     | FLOAT     | Velocidad de inferencia (ms/imagen)                   |
| is_production| BOOLEAN   | `true` si es la versión actualmente en producción      |
| created_at   | TIMESTAMP | Fecha de creación                                      |

---

## API REST — Referencia de endpoints

### Datasets (`/api/datasets`)

| Método | Ruta                       | Descripción                                                    |
|--------|----------------------------|----------------------------------------------------------------|
| GET    | `/mentat`                  | Lista datasets disponibles en GCS exportados desde MENTAT      |
| GET    | `/manual`                  | Lista datasets manuales registrados en BD                      |
| POST   | `/upload/init`             | Crea registro en BD y devuelve URL de sesión resumable GCS     |
| POST   | `/upload/complete`         | Confirma la subida y encola la tarea Celery de extracción      |
| GET    | `/{id}/status`             | Devuelve estado y mensaje de progreso del dataset              |
| DELETE | `/{id}`                    | Elimina dataset de BD y GCS                                    |

### Training (`/api/training`)

| Método | Ruta                       | Descripción                                                    |
|--------|----------------------------|----------------------------------------------------------------|
| POST   | `/jobs`                    | Crea un job y encola la tarea Celery de lifecycle de VM        |
| GET    | `/jobs`                    | Lista todos los jobs con estado y métricas finales             |
| GET    | `/jobs/{id}`               | Detalle de un job específico                                    |
| GET    | `/jobs/{id}/metrics`       | Serie temporal de métricas por epoch                           |
| POST   | `/jobs/{id}/metrics`       | Callback de VM2: registra métricas de un epoch                 |
| PATCH  | `/jobs/{id}`               | Callback de VM2: actualiza estado final del job               |

### Models (`/api/models`)

| Método | Ruta                       | Descripción                                                    |
|--------|----------------------------|----------------------------------------------------------------|
| GET    | `/`                        | Lista todos los modelos y sus versiones                        |
| GET    | `/{model_name}`            | Todas las versiones de un modelo con métricas comparadas       |
| POST   | `/`                        | Registra una nueva versión (callback de VM2)                   |
| POST   | `/{id}/promote`            | Promueve una versión a producción (escritura atómica en GCS)   |

### Inference (`/api/inference`)

| Método | Ruta                       | Descripción                                                    |
|--------|----------------------------|----------------------------------------------------------------|
| GET    | `/status`                  | Estado del modelo en producción cargado en memoria             |
| POST   | `/predict`                 | Inferencia: imagen → detecciones (bboxes, clases, scores)      |

---

## Stack tecnológico

| Capa                  | Tecnología                                           |
|-----------------------|------------------------------------------------------|
| Framework API         | FastAPI + Uvicorn                                    |
| Frontend              | React 18 + Vite                                      |
| ORM / Base de datos   | SQLAlchemy + PostgreSQL 16                           |
| Cola de tareas        | Celery 5 + Redis 7                                   |
| Motor de entrenamiento| Ultralytics YOLO (YOLOv8 / YOLO11)                  |
| Cloud storage         | Google Cloud Storage (`google-cloud-storage`)        |
| Upload de datasets    | GCS Resumable Upload Sessions (XHR directo frontend→GCS) |
| Ciclo de vida VM      | GCP Compute Engine API (`google-api-python-client`)  |
| Contenerización       | Docker + Docker Compose                              |
| Proxy reverso         | Nginx Alpine                                         |

---

## Integración con MENTAT

El único cambio requerido en MENTAT para la integración completa es:

1. **Nuevo botón en exportación**: "Exportar a GCS" (el export ZIP local existente no se modifica).
2. **Escritura en GCS**: el export genera la estructura `datasets/{project}/{timestamp}/` con `data.yaml` y `metadata.json` conforme al schema canónico.
3. **Credenciales**: variable de entorno `GOOGLE_APPLICATION_CREDENTIALS` apuntando a una service account con permisos `storage.objectAdmin` sobre el bucket compartido.

---

## Consideraciones de diseño y seguridad

- **Atomicidad del puntero de producción**: `production.json` se actualiza con `if_generation_match=current_generation`, previniendo escrituras concurrentes sin necesidad de un sistema de bloqueo externo.
- **Auto-apagado garantizado de VM2**: el script de inicio de VM2 incluye `trap EXIT` y el bloque `finally` en Python siempre ejecuta `gcloud compute instances stop`, incluso en caso de excepción no controlada.
- **Concurrencia=1 en extracción**: la cola Celery de extracción opera con un único worker para evitar la saturación del disco persistente de VM1 durante extracciones concurrentes de ZIPs grandes.
- **Upload directo frontend→GCS**: los datasets nunca transitan por el backend, eliminando el riesgo de timeouts HTTP y reduciendo el consumo de memoria de VM1.
- **Lifecycle rules de GCS**: los ZIPs temporales en `temp-uploads/` se eliminan automáticamente a los 7 días mediante una regla de ciclo de vida del bucket.
- **Logs de error en GCS**: ante un fallo en VM2, la traza completa se sube a `gs://bucket/logs/job-{id}-error.txt` antes del apagado, garantizando trazabilidad post-mortem.

---

## Variables de entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:password@db:5432/alphaplus

# Redis (Celery broker)
REDIS_URL=redis://redis:6379/0

# Google Cloud Storage
GCS_BUCKET=
GCS_PROJECT=
GOOGLE_APPLICATION_CREDENTIALS=

# GCP Compute Engine (VM2)
GCP_ZONE=us-central1-a
GPU_VM_NAME=alphaplus-trainer
APP_VM_INTERNAL_IP=

# Almacenamiento local de extracción (volumen Docker)
EXTRACTION_PATH=/data/extraction
```

---

*Fábrica de Modelos de IA Industrial — v1.0 — Marzo 2026*
*Proyecto EXPAI SmartIndustry (EUREKA 21028) — Confidencial — No distribuir*
