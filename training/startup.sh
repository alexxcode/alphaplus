#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ALPHA PLUS — VM2 Startup Script
# GCP ejecuta este script automáticamente cuando la VM arranca.
# ─────────────────────────────────────────────────────────────────────────────
set -e

LOG_FILE="/var/log/alphaplus-train.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== ALPHA PLUS training startup: $(date) ==="

# ── Leer metadata desde el servidor de metadatos de GCP ──────────────────────
METADATA="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
HEADER="Metadata-Flavor: Google"

export GCS_BUCKET=$(curl -sf -H "$HEADER" "$METADATA/alphaplus-gcs-bucket"      || echo "")
export JOB_ID=$(curl -sf     -H "$HEADER" "$METADATA/alphaplus-job-id"          || echo "")
export BACKEND_API_URL=$(curl -sf -H "$HEADER" "$METADATA/alphaplus-backend-url" || echo "")
export ZONE=$(curl -sf       -H "$HEADER" \
  "http://metadata.google.internal/computeMetadata/v1/instance/zone" | cut -d/ -f4)

echo "JOB_ID=$JOB_ID  BUCKET=$GCS_BUCKET  ZONE=$ZONE  API=$BACKEND_API_URL"

# Verificar variables obligatorias
if [ -z "$GCS_BUCKET" ] || [ -z "$JOB_ID" ]; then
  echo "ERROR: GCS_BUCKET o JOB_ID no definidos en metadata. Apagando VM."
  gcloud compute instances stop "$(hostname)" --zone="$ZONE"
  exit 1
fi

# ── Safety net: apagar la VM aunque el script falle ──────────────────────────
# (el propio train_worker.py también lo hace; esto es el safety net externo)
trap 'echo "Trap EXIT — apagando VM..."; gcloud compute instances stop "$(hostname)" --zone="$ZONE"' EXIT

# ── Preparar entorno ──────────────────────────────────────────────────────────
WORK_DIR="/opt/alphaplus-training"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Descargar scripts de entrenamiento desde GCS
echo "Descargando scripts desde gs://$GCS_BUCKET/training/ ..."
gsutil cp "gs://$GCS_BUCKET/training/train_worker.py"  .
gsutil cp "gs://$GCS_BUCKET/training/requirements.txt" .

# Instalar dependencias (DLVM image usa pip3/python3)
pip3 install -q -r requirements.txt

# Upload log a GCS al final para debugging (además del apagado en trap)
trap 'echo "Trap EXIT — $(date)"; gsutil cp "$LOG_FILE" "gs://$GCS_BUCKET/logs/job-${JOB_ID}-$(date +%s).log" 2>/dev/null || true; gcloud compute instances stop "$(hostname)" --zone="$ZONE"' EXIT

# ── Ejecutar entrenamiento ────────────────────────────────────────────────────
echo "Iniciando train_worker.py para job $JOB_ID ..."
python3 train_worker.py

echo "=== Training script finalizó: $(date) ==="
# El trap EXIT dispara el apagado
