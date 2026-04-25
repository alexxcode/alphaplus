# AlphaPlus — Industrial AI Model Factory

**AlphaPlus** is a full-stack platform for training, evaluating, and deploying computer vision models in industrial environments. It automates the complete lifecycle of a YOLO model: from labeled dataset ingestion to a production inference REST endpoint — running on Google Cloud Platform with near-zero idle cost.

---

## How it works

```
 ┌──────────────┐   labeled datasets   ┌─────────────────────────────────────────────────────┐
 │   Labeling   │ ──────────────────▶  │                Google Cloud Storage                  │
 │   Platform   │                      │  datasets/  │  jobs/  │  models/  │  logs/           │
 └──────────────┘                      └──────────────────────────────────────────────────────┘
                                               ▲                        │
                        manual ZIP upload ─────┤                        │ best.pt + metrics
                                               │                        ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │  VM1 — App Server (always on, e2-standard-4)                                            │
 │                                                                                         │
 │   nginx :80 ──▶ frontend (React/Vite)       ──▶  Dataset Browser                       │
 │                                                   Training Manager                      │
 │            ──▶ backend  (FastAPI :8000)            Model Registry                       │
 │                   │                               Inference Dashboard                   │
 │                   ├── Celery worker-vm   (vm_lifecycle queue)                           │
 │                   └── Celery worker      (dataset_extraction queue)                     │
 │                         │                                                               │
 │                   PostgreSQL 16 + Redis 7                                               │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
                                │  GCP Compute Engine API
                                │  start / stop / set-metadata
                                ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │  VM2 — GPU Trainer (on-demand, g2-standard-8 + NVIDIA L4)                              │
 │                                                                                         │
 │   startup.sh  ──▶  download train_worker.py from GCS                                   │
 │                ──▶  pip install requirements                                            │
 │                ──▶  train_worker.py                                                     │
 │                        1. read config.json from GCS                                     │
 │                        2. download dataset from GCS                                     │
 │                        3. YOLO.train()  ──▶  POST /api/training/jobs/{id}/metrics       │
 │                        4. upload best.pt, metrics.json to GCS                           │
 │                        5. POST /api/models  (register version)                          │
 │                        6. PATCH /api/training/jobs/{id}  (completed)                   │
 │                        7. gcloud compute instances stop $(hostname)  ◀── always runs    │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

VM2 shuts itself down after every run — success or failure. **GPU costs only accrue during active training.**

---

## Installation

### Prerequisites

| Requirement | Notes |
|---|---|
| Docker + Docker Compose v2 | VM1 host |
| GCP project | Billing enabled |
| GCS bucket | Single bucket for all data |
| GCP Service Account | `storage.objectAdmin` + `compute.instanceAdmin.v1` |
| VM1 (e2-standard-4) | The app server — always running |
| VM2 (g2-standard-8 + NVIDIA L4) | GPU trainer — started/stopped automatically |

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/alexisrrm13/alphaplus.git
cd alphaplus
```

---

### Step 2 — Create GCP infrastructure

#### 2a. Create the GCS bucket

```bash
gcloud storage buckets create gs://YOUR_BUCKET_NAME \
  --project=YOUR_PROJECT_ID \
  --location=us-central1 \
  --uniform-bucket-level-access
```

Add a lifecycle rule to auto-delete temporary uploads after 7 days:

```bash
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [{
    "action": { "type": "Delete" },
    "condition": {
      "matchesPrefix": ["temp-uploads/"],
      "age": 7
    }
  }]
}
EOF
gcloud storage buckets update gs://YOUR_BUCKET_NAME \
  --lifecycle-file=/tmp/lifecycle.json
```

#### 2b. Create a Service Account

```bash
gcloud iam service-accounts create alphaplus-sa \
  --display-name="AlphaPlus Service Account" \
  --project=YOUR_PROJECT_ID

# Grant GCS access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:alphaplus-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Grant Compute Engine access (to start/stop VM2)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:alphaplus-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"

# Download credentials
gcloud iam service-accounts keys create credentials/service-account.json \
  --iam-account=alphaplus-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### 2c. Create VM2 (GPU trainer)

```bash
gcloud compute instances create YOUR_TRAINER_VM_NAME \
  --project=YOUR_PROJECT_ID \
  --zone=us-central1-b \
  --machine-type=g2-standard-8 \
  --accelerator=type=nvidia-l4,count=1 \
  --maintenance-policy=TERMINATE \
  --no-restart-on-failure \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --metadata-from-file=startup-script=training/startup.sh \
  --scopes=https://www.googleapis.com/auth/cloud-platform
```

> **Note:** VM2 is created once and left in `TERMINATED` state. AlphaPlus starts and stops it automatically for each training job.

#### 2d. Upload the training worker to GCS

```bash
gcloud storage cp training/train_worker.py \
  gs://YOUR_BUCKET_NAME/training/train_worker.py

gcloud storage cp training/requirements.txt \
  gs://YOUR_BUCKET_NAME/training/requirements.txt
```

---

### Step 3 — Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# PostgreSQL
DATABASE_URL=postgresql://alphaplus:alphaplus@db:5432/alphaplus

# Redis
REDIS_URL=redis://redis:6379/0

# Google Cloud Storage
GCS_BUCKET=your-bucket-name
GCS_PROJECT=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/service-account.json

# GCP Compute Engine
GCP_PROJECT=your-gcp-project-id
GCP_ZONE=us-central1-b
GPU_VM_NAME=your-trainer-vm-name

# VM1 internal IP (reachable from VM2 during training)
APP_VM_INTERNAL_IP=10.x.x.x
```

---

### Step 4 — Build and start

```bash
docker compose up -d --build
```

This starts 7 containers:

```
nginx        — reverse proxy on :80
frontend     — React 18 + Vite UI
backend      — FastAPI REST API
worker       — Celery: dataset extraction (concurrency=1)
worker_vm    — Celery: VM lifecycle (concurrency=4)
db           — PostgreSQL 16
redis        — Redis 7 (Celery broker)
```

Verify all containers are healthy:

```bash
docker compose ps
```

---

### Step 5 — Verify

Open `http://YOUR_VM1_IP` in a browser. You should see the AlphaPlus dashboard.

To run a quick end-to-end check:

```bash
# Check API is up
curl http://localhost/api/inference/status

# Check Celery workers registered all tasks
docker compose exec worker_vm celery -A app.tasks.celery_app inspect registered
```

Expected output:
```
worker_vm@...: OK
  * app.tasks.vm_tasks.launch_training_job
  * app.tasks.dataset_extraction.extract_dataset_zip
  * app.tasks.gdrive_import.import_from_gdrive
```

---

### Step 6 — First training job

1. **Upload a dataset** — go to *Dataset Browser → Manual Upload*, drag a YOLO-format ZIP (up to 20 GB).
2. **Wait for extraction** — status will change from `extracting → validating → ready`.
3. **Create a training job** — go to *Training Manager*, select the dataset, pick a model type (`yolo11s` recommended for first run), set epochs.
4. **Monitor** — the UI polls metrics in real time as VM2 trains and reports per-epoch results.
5. **Promote** — once completed, go to *Model Registry* and promote the version to production.
6. **Infer** — call `POST /api/inference/predict` with an image.

---

## Deploying updates

The `deploy.sh` script rebuilds only the services that changed:

```bash
# Rebuild backend and frontend
./deploy.sh

# Rebuild all workers (required after changing vm_tasks.py or adding new Celery tasks)
docker compose up -d --build worker_vm worker
```

After modifying `train_worker.py`, always re-upload to GCS:

```bash
gcloud storage cp training/train_worker.py \
  gs://YOUR_BUCKET_NAME/training/train_worker.py
```

---

## GCS bucket structure

```
gs://{bucket}/
├── temp-uploads/              # Temporary ZIPs — auto-deleted after 7 days
│   └── {uuid}/upload.zip
│
├── datasets/
│   ├── {project}/             # Datasets synced from an external labeling platform
│   │   └── {timestamp}/
│   │       ├── data.yaml      # Canonical GCS paths
│   │       ├── metadata.json
│   │       ├── train/images/ + labels/
│   │       └── val/images/ + labels/
│   └── manual/                # Manually uploaded datasets
│       └── {uuid}/
│
├── jobs/pending/{job_id}/
│   └── config.json            # Job config written before VM2 starts
│
├── models/{model_name}/
│   ├── v1/
│   │   ├── best.pt            # Best checkpoint (by val mAP)
│   │   └── metrics.json
│   ├── v2/ ...
│   └── production.json        # Atomic pointer to active version
│
└── logs/
    └── job-{id}-error.txt     # VM2 error traces (when applicable)
```

---

## API reference

### Datasets — `/api/datasets`

| Method | Path | Description |
|---|---|---|
| GET | `/mentat` | List datasets synced from an external labeling platform via GCS (GCS-based auto-discovery) |
| GET | `/manual` | List manually uploaded datasets |
| POST | `/upload/init` | Create DB record + get GCS resumable upload URL |
| POST | `/upload/complete` | Confirm upload, enqueue extraction task |
| GET | `/{id}/status` | Poll extraction progress |
| DELETE | `/{id}` | Delete dataset from DB and GCS |

### Training — `/api/training`

| Method | Path | Description |
|---|---|---|
| POST | `/jobs` | Launch training job (starts VM2) |
| GET | `/jobs` | List all jobs |
| GET | `/jobs/{id}` | Job detail |
| GET | `/jobs/{id}/metrics` | Per-epoch metrics time series |
| POST | `/jobs/{id}/metrics` | VM2 callback — report epoch metrics |
| PATCH | `/jobs/{id}` | VM2 callback — update final status |

### Models — `/api/models`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all model versions |
| GET | `/{model_name}` | Versions for a specific model |
| POST | `/import` | Import an external pre-trained `.pt` file |
| POST | `/{id}/promote` | Promote version to production (atomic GCS write) |
| GET | `/{id}/download` | Stream `best.pt` from GCS |

### Inference — `/api/inference`

| Method | Path | Description |
|---|---|---|
| GET | `/status` | Check production model is loaded |
| POST | `/predict` | Run detection — image → bboxes, classes, scores |
| POST | `/predict-annotated` | Run detection — video → annotated MP4 |

---

## Stack

| Layer | Technology |
|---|---|
| API | FastAPI + Uvicorn |
| Frontend | React 18 + Vite |
| Database | PostgreSQL 16 + SQLAlchemy |
| Task queue | Celery 5 + Redis 7 |
| Training engine | Ultralytics YOLO (YOLOv8 / YOLO11) |
| Cloud storage | Google Cloud Storage |
| VM orchestration | GCP Compute Engine API |
| Containerization | Docker + Docker Compose |
| Reverse proxy | Nginx Alpine |

---

## Dataset format

AlphaPlus accepts YOLO-format ZIP files. Supported internal layouts:

**Split** (standard):
```
dataset.zip/
├── train/images/  + train/labels/
└── val/images/    + val/labels/
```

**Nested**:
```
dataset.zip/
├── images/train/  + images/val/
└── labels/train/  + labels/val/
```

**Flat** (auto-split 80/20):
```
dataset.zip/
├── images/
└── labels/
```

All layouts are normalized automatically. The extractor validates label format (5 fields, class IDs within range, coordinates in [0,1]) on a 5% sample before accepting the dataset.

---

## Design decisions

**Direct frontend → GCS upload.** Datasets never pass through the backend. The frontend uploads directly to GCS via a resumable upload session URL. This eliminates HTTP timeouts and memory pressure on VM1 for large datasets (tested up to 20 GB).

**VM2 always self-terminates.** The training script runs `gcloud compute instances stop $(hostname)` in a `finally` block, unconditionally. GPU charges cannot accumulate from forgotten instances.

**Atomic production pointer.** `production.json` is written with `if_generation_match` (GCS optimistic locking). Concurrent promotions from multiple users cannot corrupt the active version pointer.

**Celery extraction queue concurrency=1.** Dataset extraction is disk-bound. A single concurrent extraction prevents disk saturation during large ZIP processing on VM1.

---

## License

MIT

---

*AlphaPlus — Industrial AI Model Factory*
