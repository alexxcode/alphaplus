const docx = require('C:/nvm4w/nodejs/node_modules/docx');
const fs = require('fs');

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = docx;

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  darkBlue:  "0D1B2A",
  midBlue:   "1B4F72",
  accent:    "2E86C1",
  lightBg:   "D6EAF8",
  hdrBg:     "1B4F72",
  rowAlt:    "EBF5FB",
  gray:      "2C3E50",
  white:     "FFFFFF",
  muted:     "7F8C8D",
  codeBg:    "F2F3F4",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const B  = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const CB = { top: B, bottom: B, left: B, right: B };

const page = { width: 11906, height: 16838 };
const margin = { top: 1134, bottom: 1134, left: 1134, right: 1134 }; // ~2cm
const contentW = page.width - margin.left - margin.right; // 9638 DXA

function hdrCell(text, w) {
  return new TableCell({
    borders: CB, width: { size: w, type: WidthType.DXA },
    shading: { fill: C.hdrBg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: C.white, size: 18, font: "Arial" })]
    })]
  });
}

function cell(text, w, opts = {}) {
  const { bold = false, fill = C.white, color = C.gray, center = false, mono = false } = opts;
  return new TableCell({
    borders: CB, width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 140, right: 140 },
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold, color, size: 18, font: mono ? "Courier New" : "Arial" })]
    })]
  });
}

function table(rows, colWidths, { full = true } = {}) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, color: C.darkBlue })],
    spacing: { before: 480, after: 180 },
    border: { bottom: { style: BorderStyle.THICK, size: 6, color: C.accent, space: 6 } }
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, color: C.midBlue })],
    spacing: { before: 300, after: 120 }
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, color: C.accent })],
    spacing: { before: 200, after: 80 }
  });
}

function p(text, opts = {}) {
  const { bold = false, italic = false, color = C.gray, size = 20, mono = false } = opts;
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 40, after: 140, line: 320, lineRule: "auto" },
    children: [new TextRun({ text, bold, italic, color, size, font: mono ? "Courier New" : "Arial" })]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 60 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: C.gray })]
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: level === 0 ? "numbers" : "numbers2", level: 0 },
    spacing: { before: 40, after: 60 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: C.gray })]
  });
}

function codeLine(text) {
  return new Paragraph({
    indent: { left: 400 },
    spacing: { before: 20, after: 20 },
    shading: { fill: C.codeBg, type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: "Courier New", color: "1A5276" })]
  });
}

function sp(n = 1) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: 0, after: 80 * n } });
}

function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

function label(text) {
  return new TextRun({ text, bold: true, color: C.accent, size: 18, font: "Arial" });
}

// ─── PORTADA ──────────────────────────────────────────────────────────────────
const cover = [
  sp(6),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "ALPHA PLUS", bold: true, size: 72, font: "Arial", color: C.darkBlue })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "v 0.1", size: 28, font: "Arial", color: C.muted })]
  }),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 4 } },
    children: [new TextRun("")]
  }),
  sp(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "DOCUMENTO TECNICO DE SOFTWARE", bold: true, size: 36, font: "Arial", color: C.midBlue })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 400 },
    children: [new TextRun({ text: "Pipeline Completo — Fabrica de Modelos de IA Industrial", size: 24, font: "Arial", color: C.gray })]
  }),
  sp(3),
  table([
    new TableRow({ children: [cell("Proyecto",   2400, { bold: true, fill: C.lightBg }), cell("Alpha Plus — Plataforma de Entrenamiento YOLO Industrial", 7238)] }),
    new TableRow({ children: [cell("Version",    2400, { bold: true, fill: C.lightBg }), cell("0.1 — Arquitectura Draft, Marzo 2026", 7238)] }),
    new TableRow({ children: [cell("Dominio",    2400, { bold: true, fill: C.lightBg }), cell("Computer Vision / Industrial AI / MLOps", 7238)] }),
    new TableRow({ children: [cell("Enfoque",    2400, { bold: true, fill: C.lightBg }), cell("Fabrica de modelos YOLO a partir de datasets etiquetados en formato YOLO", 7238)] }),
    new TableRow({ children: [cell("Clasificacion", 2400, { bold: true, fill: C.lightBg }), cell("Privado y Confidencial", 7238)] }),
  ], [2400, 7238]),
  pb()
];

// ─── INDICE ────────────────────────────────────────────────────────────────────
const toc = [
  h1("Indice de Contenidos"),
  new TableOfContents("Tabla de Contenidos", { hyperlink: true, headingStyleRange: "1-3" }),
  pb()
];

// ─── 1. DESCRIPCION GENERAL ───────────────────────────────────────────────────
const s1 = [
  h1("1. Descripcion General del Sistema"),
  p("Alpha Plus es una plataforma web de MLOps especializada en el entrenamiento, gestion y despliegue de modelos de deteccion de objetos basados en la arquitectura YOLO (You Only Look Once). El sistema opera como una fabrica de modelos de IA: recibe datasets etiquetados en formato YOLO, orquesta el ciclo completo de entrenamiento sobre hardware GPU bajo demanda, registra los artefactos generados y expone un endpoint de inferencia production-ready."),
  p("El sistema resuelve el problema de la disponibilidad de GPU para entrenamiento de modelos de alta precision en entornos industriales, desacoplando la infraestructura computacional costosa (GPU) de la infraestructura de aplicacion siempre activa, mediante una arquitectura de dos maquinas virtuales en Google Cloud Platform (GCP) cuyo ciclo de vida se gestiona automaticamente."),
  sp(),

  h2("1.1. Proposito Funcional"),
  p("El proposito central es proporcionar a equipos de vision artificial industriales una interfaz self-service para gestionar el ciclo completo de vida de modelos YOLO:"),
  bullet("Ingestion y validacion de datasets etiquetados (desde sistemas MENTAT o carga manual de archivos ZIP)."),
  bullet("Lanzamiento de trabajos de entrenamiento sobre GPU bajo demanda con configuracion parametrizable."),
  bullet("Registro versionado de los modelos entrenados con sus metricas de evaluacion."),
  bullet("Promocion atomica de modelos a produccion y ejecucion de inferencia en tiempo real."),
  sp(),

  h2("1.2. Contexto de Uso"),
  p("Alpha Plus se integra en un ecosistema industrial mas amplio en el que el sistema MENTAT actua como plataforma de etiquetado de datos. Los datasets producidos por MENTAT se exportan directamente a Google Cloud Storage (GCS), desde donde Alpha Plus los importa para el entrenamiento. Los modelos resultantes pueden utilizarse para inferencia sobre imagenes de lineas de produccion, sistemas de inspeccion de calidad o plataformas de colaboracion humano-robot."),
  sp(),

  h2("1.3. Restricciones y Alcance"),
  bullet("Solo soporta modelos de la familia Ultralytics YOLOv8 y YOLO11 (yolov8n, yolov8s, yolov8m, yolov8l, yolov8x, yolo11n...yolo11x)."),
  bullet("Datos de entrada en formato YOLO (images/ + labels/ con archivos .txt en formato normalizado)."),
  bullet("Infraestructura exclusivamente sobre GCP: GCS para almacenamiento, Compute Engine para GPU."),
  bullet("Tamano maximo de dataset: 20 GB por carga."),
  bullet("Timeout maximo de entrenamiento: 4 horas por trabajo."),
  sp()
];

// ─── 2. ARQUITECTURA ──────────────────────────────────────────────────────────
const s2 = [
  h1("2. Arquitectura del Sistema"),
  h2("2.1. Modelo de Dos Maquinas Virtuales"),
  p("La arquitectura de Alpha Plus se articula sobre dos maquinas virtuales (VM) en GCP con roles complementarios y ciclos de vida asimetricos:"),
  sp(),

  table([
    new TableRow({ children: [hdrCell("Dimension", 2000), hdrCell("VM1 — Servidor de Aplicacion", 3819), hdrCell("VM2 — Worker de Entrenamiento GPU", 3819)] }),
    new TableRow({ children: [
      cell("Tipo de maquina", 2000, { bold: true, fill: C.rowAlt }),
      cell("e2-standard-4 (4 vCPU, 16 GB RAM)", 3819),
      cell("n1-standard-8 + NVIDIA A100 (o T4/V100)", 3819)
    ]}),
    new TableRow({ children: [
      cell("GPU", 2000, { bold: true, fill: C.rowAlt }),
      cell("No", 3819),
      cell("Si — NVIDIA A100 (40 GB HBM2)", 3819)
    ]}),
    new TableRow({ children: [
      cell("Disponibilidad", 2000, { bold: true, fill: C.rowAlt }),
      cell("Siempre activa", 3819),
      cell("Solo durante entrenamiento (auto-shutdown)", 3819)
    ]}),
    new TableRow({ children: [
      cell("Coste estimado", 2000, { bold: true, fill: C.rowAlt }),
      cell("~$0.05–0.10/hora", 3819),
      cell("~$3.00–4.00/hora (solo activa durante training)", 3819)
    ]}),
    new TableRow({ children: [
      cell("Servicios", 2000, { bold: true, fill: C.rowAlt }),
      cell("FastAPI, React, PostgreSQL, Redis, Celery (x2), Nginx", 3819),
      cell("train_worker.py (Ultralytics YOLO, GCS client)", 3819)
    ]}),
    new TableRow({ children: [
      cell("Almacenamiento", 2000, { bold: true, fill: C.rowAlt }),
      cell("Disco persistente 150 GB para extraccion de ZIPs", 3819),
      cell("Disco efimero para descarga de datasets y artefactos", 3819)
    ]}),
  ], [2000, 3819, 3819]),
  sp(),

  h2("2.2. Capas del Sistema"),
  p("El sistema se organiza en cinco capas funcionales:"),
  sp(),

  table([
    new TableRow({ children: [hdrCell("Capa", 2000), hdrCell("Componentes", 3400), hdrCell("Tecnologia", 4238)] }),
    new TableRow({ children: [cell("Presentacion", 2000, { bold: true, fill: C.rowAlt }), cell("Frontend React SPA", 3400), cell("React 18.3, Vite 5.2, React Router v6", 4238)] }),
    new TableRow({ children: [cell("API REST", 2000, { bold: true, fill: C.rowAlt }), cell("Endpoints HTTP + reverse proxy", 3400), cell("FastAPI 0.111, Uvicorn 0.29, Nginx (alpine)", 4238)] }),
    new TableRow({ children: [cell("Logica de negocio", 2000, { bold: true, fill: C.rowAlt }), cell("Routers, servicios, tareas asincronas", 3400), cell("Python 3.11, Celery 5.4, SQLAlchemy 2.0", 4238)] }),
    new TableRow({ children: [cell("Persistencia local", 2000, { bold: true, fill: C.rowAlt }), cell("Base de datos relacional + broker de mensajes", 3400), cell("PostgreSQL 16, Redis 7", 4238)] }),
    new TableRow({ children: [cell("Almacenamiento cloud", 2000, { bold: true, fill: C.rowAlt }), cell("Datasets, modelos, logs, configs", 3400), cell("Google Cloud Storage (GCS), GCP Compute Engine API", 4238)] }),
  ], [2000, 3400, 4238]),
  sp(),

  h2("2.3. Estructura de Buckets GCS"),
  p("Google Cloud Storage actua como capa de persistencia central para todos los artefactos del sistema:"),
  sp(),
  codeLine("gs://{bucket}/"),
  codeLine("  temp-uploads/                        # ZIPs temporales (TTL 7 dias)"),
  codeLine("    {upload_uuid}/upload.zip"),
  codeLine("  datasets/"),
  codeLine("    {project_name}/{timestamp}/         # Exportaciones MENTAT"),
  codeLine("      data.yaml | metadata.json | train/ | val/"),
  codeLine("    manual/{upload_uuid}/               # Cargas manuales"),
  codeLine("      data.yaml | metadata.json | train/ | val/"),
  codeLine("  models/"),
  codeLine("    {model_name}/v{N}/                  # Versiones de modelo"),
  codeLine("      best.pt | last.pt | metrics.json"),
  codeLine("    {model_name}/production.json        # Puntero atomico a version activa"),
  codeLine("  jobs/"),
  codeLine("    pending/{job_id}/config.json        # Configuracion de trabajo"),
  codeLine("  logs/"),
  codeLine("    job-{job_id}-*.log                  # Logs de entrenamiento VM2"),
  sp()
];

// ─── 3. PIPELINE COMPLETO ─────────────────────────────────────────────────────
const s3 = [
  h1("3. Pipeline Completo: Fabrica de Modelos"),
  p("El pipeline de Alpha Plus se divide en cuatro fases principales que cubren el ciclo de vida completo desde la ingesta de datos hasta la inferencia en produccion. Las fases son secuenciales pero las tres primeras son independientes entre si: un dataset puede existir sin un trabajo de entrenamiento asociado, y un trabajo puede completarse sin que el modelo sea promovido a produccion."),
  sp(),

  h2("3.1. Fase 1 — Ingesta y Validacion de Datasets"),
  h3("3.1.1. Origen A: Datasets MENTAT (importacion pasiva)"),
  p("Los datasets generados por el sistema MENTAT se exportan directamente a GCS bajo la ruta gs://bucket/datasets/{project_name}/{timestamp}/. Alpha Plus los descubre mediante una enumeracion de prefijos en GCS sin necesidad de ninguna accion del usuario:"),
  numbered("El router GET /api/datasets/mentat invoca gcs_client.list_mentat_datasets()."),
  numbered("La funcion enumera los directorios de primer nivel (proyectos) y los de segundo nivel (timestamps)."),
  numbered("Para cada timestamp, lee metadata.json y construye el objeto DatasetInfo (nombre, clases, numero de imagenes, fecha)."),
  numbered("El frontend muestra los datasets en la pestana MENTAT del DatasetBrowser."),
  sp(),

  h3("3.1.2. Origen B: Carga manual (upload directo a GCS)"),
  p("Para datasets no provenientes de MENTAT, el usuario carga un archivo ZIP con la estructura YOLO a traves de la interfaz web. El proceso elimina la carga en el servidor de aplicacion mediante upload directo al bucket GCS:"),
  numbered("El usuario selecciona el archivo ZIP en el UploadModal y proporciona el nombre del proyecto."),
  numbered("El frontend llama a POST /api/datasets/upload/init con {filename, file_size, project_name}."),
  numbered("El backend crea un registro Dataset en PostgreSQL (status=pending_upload) y genera una sesion de carga reanudable en GCS (Resumable Upload Session) apuntando a temp-uploads/{upload_uuid}/upload.zip."),
  numbered("El frontend realiza la carga del fichero directamente a GCS via XMLHttpRequest, rastreando el progreso (velocidad, ETA, porcentaje). El fichero nunca transita por VM1."),
  numbered("Al completar la carga, el frontend llama a POST /api/datasets/upload/complete con {dataset_id, upload_id}."),
  numbered("El backend encola la tarea Celery extract_dataset_zip(dataset_id, upload_id) y actualiza el estado a extracting."),
  sp(),

  h3("3.1.3. Tarea Celery: extract_dataset_zip"),
  p("Esta tarea ejecuta el pipeline de validacion y normalizacion del dataset sobre un worker con concurrencia=1 (para evitar contention de disco en el disco de extraccion de 150 GB):"),
  numbered("Verificacion de espacio en disco: requiere 5x el tamano del ZIP disponible."),
  numbered("Descarga del ZIP desde GCS a /data/extraction/{upload_id}/."),
  numbered("Validacion de integridad del ZIP (CRC checks)."),
  numbered("Deteccion automatica del layout YOLO mediante _detect_layout():"),
  bullet("split: ya contiene carpetas train/ y val/ en la raiz.", 1),
  bullet("nested: contiene subcarpetas tipo splits/{train,val}/images/.", 1),
  bullet("flat: todas las imagenes y etiquetas en un mismo directorio.", 1),
  numbered("Reestructuracion al formato canonico split:"),
  bullet("nested -> restructure_nested(): reorganiza la jerarquia.", 1),
  bullet("flat -> _auto_split(): divide 80% train / 20% val de forma estratificada.", 1),
  numbered("Validacion de etiquetas YOLO: muestrea el 5% de los archivos .txt y verifica que los class_id < nc y que las coordenadas esten en el rango [0.0, 1.0]."),
  numbered("Generacion del archivo data.yaml canonico con rutas relativas a GCS y lista de clases."),
  numbered("Generacion de metadata.json con estadisticas del dataset (num_images, num_classes, class_names, created_at)."),
  numbered("Subida paralela del directorio restructurado a gs://bucket/datasets/manual/{upload_uuid}/ usando ThreadPoolExecutor con 16 workers."),
  numbered("Actualizacion del registro Dataset en PostgreSQL: status=ready."),
  p("En caso de error, la tarea captura ValidationError y guarda el mensaje en dataset.error_message con status=failed. No hay reintentos (max_retries=0) para evitar efectos secundarios."),
  sp(),

  h2("3.2. Fase 2 — Lanzamiento y Ejecucion del Entrenamiento"),
  h3("3.2.1. Creacion del Trabajo"),
  p("El usuario configura el trabajo de entrenamiento a traves de la interfaz TrainingManager y envia POST /api/training/jobs con los parametros:"),
  table([
    new TableRow({ children: [hdrCell("Parametro", 2800), hdrCell("Tipo", 1800), hdrCell("Descripcion", 5038)] }),
    new TableRow({ children: [cell("dataset_id", 2800, { mono: true }), cell("UUID", 1800, { center: true }), cell("Identificador del dataset (MENTAT o manual)", 5038)] }),
    new TableRow({ children: [cell("model_type", 2800, { mono: true }), cell("Enum", 1800, { center: true }), cell("Arquitectura YOLO base: yolov8n/s/m/l/x, yolo11n...yolo11x", 5038)] }),
    new TableRow({ children: [cell("model_name", 2800, { mono: true }), cell("String", 1800, { center: true }), cell("Nombre del modelo en el registro (libre eleccion del usuario)", 5038)] }),
    new TableRow({ children: [cell("epochs", 2800, { mono: true }), cell("Integer", 1800, { center: true }), cell("Numero de epocas de entrenamiento (1 - N)", 5038)] }),
    new TableRow({ children: [cell("batch_size", 2800, { mono: true }), cell("Integer", 1800, { center: true }), cell("Tamano de batch para el optimizador", 5038)] }),
  ], [2800, 1800, 5038]),
  sp(),
  p("El backend crea un registro Job en PostgreSQL (status=pending) y encola la tarea Celery launch_training_job(job_id) en la cola vm_lifecycle."),
  sp(),

  h3("3.2.2. Tarea Celery: launch_training_job"),
  p("Esta tarea orquesta el ciclo de vida de VM2 y monitoriza el progreso del entrenamiento. Se ejecuta en la cola vm_lifecycle con concurrencia=4:"),
  numbered("Escritura de la configuracion del trabajo en GCS: gs://bucket/jobs/pending/{job_id}/config.json."),
  numbered("Actualizacion de los metadatos de instancia de VM2 via GCP Compute API: alphaplus-job-id={job_id}, alphaplus-bucket={bucket}, alphaplus-api-url=http://VM1_IP/api."),
  numbered("Inicio de VM2: instances.start() sobre la instancia GPU configurada."),
  numbered("Grace period de arranque: 45 segundos de espera inicial."),
  numbered("Polling del estado de la VM cada 30 segundos hasta status=RUNNING (timeout: 10 minutos)."),
  numbered("Actualizacion del Job en PostgreSQL: status=training."),
  numbered("Polling del estado de la VM hasta que se auto-apaga (status=TERMINATED), con timeout de 4 horas."),
  numbered("Verificacion del modelo en GCS y actualizacion del estado final del Job (completed o failed)."),
  sp(),

  h3("3.2.3. Script de arranque de VM2 (startup.sh)"),
  p("GCP ejecuta automaticamente startup.sh cuando VM2 arranca. El script realiza el bootstrap del entorno de entrenamiento:"),
  numbered("Lee el job_id y la url de la API desde el servidor de metadatos GCP (metadata.google.internal)."),
  numbered("Descarga train_worker.py y requirements.txt desde GCS."),
  numbered("Instala las dependencias Python (ultralytics, google-cloud-storage, etc.)."),
  numbered("Ejecuta train_worker.py como proceso principal."),
  numbered("Trampa de salida (trap EXIT): independientemente del resultado, ejecuta gcloud compute instances stop $(hostname) para garantizar el apagado automatico de la VM y evitar costes inesperados."),
  sp(),

  h3("3.2.4. Worker de Entrenamiento: train_worker.py"),
  p("train_worker.py contiene la logica de entrenamiento ejecutada en VM2. Su flujo es:"),
  numbered("Carga de la configuracion del trabajo desde gs://bucket/jobs/pending/{job_id}/config.json."),
  numbered("Descarga del dataset desde GCS (gs://bucket/datasets/{mentat|manual}/{id}/) al disco local de VM2."),
  numbered("Carga del modelo base YOLO preentrenado (COCO weights) segun model_type."),
  numbered("Entrenamiento con Ultralytics YOLO:"),
  bullet("Configuracion: epochs, batch_size, data=data.yaml (ruta al dataset descargado).", 1),
  bullet("Callback on_fit_epoch_end: tras cada epoca, hace POST a /api/training/jobs/{id}/metrics con {epoch, train_loss, val_loss, map50, map50_95}. El backend almacena la metrica en TrainingMetric y el frontend la muestra en tiempo real mediante polling cada 10 segundos.", 1),
  numbered("Al completar el entrenamiento, subida de artefactos a GCS:"),
  bullet("best.pt -> gs://bucket/models/{model_name}/v{N}/best.pt", 1),
  bullet("last.pt -> gs://bucket/models/{model_name}/v{N}/last.pt", 1),
  bullet("metrics.json -> gs://bucket/models/{model_name}/v{N}/metrics.json", 1),
  numbered("Registro del modelo via POST /api/models (RegisterVersionRequest) con {model_name, version, gcs_path, map50, precision, recall, speed_ms}."),
  numbered("Actualizacion del Job: PATCH /api/training/jobs/{id} -> status=completed."),
  numbered("Auto-apagado: gcloud compute instances stop $(hostname) (ademas del trap en startup.sh)."),
  sp(),

  h2("3.3. Fase 3 — Registro de Modelos y Promocion a Produccion"),
  h3("3.3.1. Registro de Versiones"),
  p("Cada ejecucion exitosa de train_worker.py genera una nueva version en el registro. Las versiones se identifican por {model_name}/v{N} donde N se incrementa automaticamente en funcion de las versiones existentes en GCS. La tabla ModelVersion en PostgreSQL almacena:"),
  table([
    new TableRow({ children: [hdrCell("Campo", 2800), hdrCell("Tipo", 1400), hdrCell("Descripcion", 5438)] }),
    new TableRow({ children: [cell("model_name", 2800), cell("String", 1400, { center: true }), cell("Nombre del modelo (clave de agrupacion en el registro)", 5438)] }),
    new TableRow({ children: [cell("version", 2800), cell("Integer", 1400, { center: true }), cell("Version numerica autoincremental por modelo", 5438)] }),
    new TableRow({ children: [cell("gcs_path", 2800), cell("String", 1400, { center: true }), cell("Ruta a los artefactos en GCS", 5438)] }),
    new TableRow({ children: [cell("map50", 2800), cell("Float", 1400, { center: true }), cell("Mean Average Precision @ IoU=0.50", 5438)] }),
    new TableRow({ children: [cell("precision", 2800), cell("Float", 1400, { center: true }), cell("Precision del mejor checkpoint", 5438)] }),
    new TableRow({ children: [cell("recall", 2800), cell("Float", 1400, { center: true }), cell("Recall del mejor checkpoint", 5438)] }),
    new TableRow({ children: [cell("speed_ms", 2800), cell("Float", 1400, { center: true }), cell("Velocidad de inferencia en milisegundos por imagen", 5438)] }),
    new TableRow({ children: [cell("is_production", 2800), cell("Boolean", 1400, { center: true }), cell("Indica si esta version esta activa en el endpoint de inferencia", 5438)] }),
    new TableRow({ children: [cell("job_id", 2800), cell("UUID FK", 1400, { center: true }), cell("Trabajo de entrenamiento que genero esta version", 5438)] }),
  ], [2800, 1400, 5438]),
  sp(),

  h3("3.3.2. Promocion Atomica a Produccion"),
  p("El usuario puede promover cualquier version a produccion desde la interfaz ModelRegistry mediante POST /api/models/{id}/promote. La operacion es atomica y transaccional:"),
  numbered("En PostgreSQL: is_production=True para la version seleccionada; is_production=False para todas las demas versiones del mismo model_name."),
  numbered("En GCS: escritura atomica de gs://bucket/models/{model_name}/production.json usando generation preconditions (If-Generation-Match) para evitar race conditions en escrituras concurrentes."),
  numbered("El modulo de inferencia invalida su cache en memoria en la siguiente peticion."),
  sp(),

  h2("3.4. Fase 4 — Inferencia en Produccion"),
  h3("3.4.1. Carga del Modelo"),
  p("El endpoint GET /api/inference/status consulta PostgreSQL para obtener la version con is_production=True. La carga del modelo desde GCS se realiza de forma lazy: el primer POST /predict descarga best.pt a memoria y lo inicializa con Ultralytics YOLO. El modelo queda cacheado en memoria del proceso FastAPI indexado por {model_name, version}."),
  sp(),

  h3("3.4.2. Endpoint de Prediccion"),
  p("POST /api/inference/predict acepta una imagen en formato multipart/form-data y retorna las detecciones en JSON:"),
  numbered("Recepcion y decodificacion de la imagen."),
  numbered("Comprobacion del cache de modelos; carga desde GCS si no esta cargado."),
  numbered("Ejecucion de YOLO inference sobre la imagen con el modelo de produccion."),
  numbered("Parseo de resultados: lista de detecciones con {class_id, class_name, confidence, bbox: [x1, y1, x2, y2]}."),
  numbered("Devolucion del JSON de detecciones al cliente."),
  p("El frontend InferenceDemo muestra las detecciones sobre la imagen con bounding boxes y etiquetas de clase y confianza."),
  sp()
];

// ─── 4. MODELOS DE DATOS ──────────────────────────────────────────────────────
const s4 = [
  h1("4. Modelos de Datos"),
  h2("4.1. Esquema de Base de Datos PostgreSQL"),
  p("El esquema relacional de Alpha Plus consta de cuatro tablas principales:"),
  sp(),

  h3("4.1.1. datasets"),
  table([
    new TableRow({ children: [hdrCell("Columna", 2400), hdrCell("Tipo", 1600), hdrCell("Restriccion / Descripcion", 5638)] }),
    new TableRow({ children: [cell("id", 2400, { mono: true }), cell("UUID", 1600, { center: true }), cell("Clave primaria generada automaticamente", 5638)] }),
    new TableRow({ children: [cell("gcs_path", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Ruta GCS al directorio canonico del dataset", 5638)] }),
    new TableRow({ children: [cell("project_name", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Nombre del proyecto de origen (MENTAT o manual)", 5638)] }),
    new TableRow({ children: [cell("source", 2400, { mono: true }), cell("ENUM", 1600, { center: true }), cell("mentat | manual", 5638)] }),
    new TableRow({ children: [cell("status", 2400, { mono: true }), cell("ENUM", 1600, { center: true }), cell("pending_upload | extracting | validating | ready | failed", 5638)] }),
    new TableRow({ children: [cell("class_count", 2400, { mono: true }), cell("INTEGER", 1600, { center: true }), cell("Numero de clases detectadas en el dataset", 5638)] }),
    new TableRow({ children: [cell("image_count", 2400, { mono: true }), cell("INTEGER", 1600, { center: true }), cell("Total de imagenes (train + val)", 5638)] }),
    new TableRow({ children: [cell("class_names", 2400, { mono: true }), cell("JSON", 1600, { center: true }), cell("Lista de nombres de clase en formato JSON", 5638)] }),
    new TableRow({ children: [cell("celery_task_id", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("ID de la tarea Celery de extraccion activa", 5638)] }),
    new TableRow({ children: [cell("original_filename", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Nombre del archivo ZIP original subido por el usuario", 5638)] }),
    new TableRow({ children: [cell("file_size_bytes", 2400, { mono: true }), cell("BIGINT", 1600, { center: true }), cell("Tamano del ZIP en bytes", 5638)] }),
    new TableRow({ children: [cell("error_message", 2400, { mono: true }), cell("TEXT", 1600, { center: true }), cell("Mensaje de error en caso de fallo de extraccion", 5638)] }),
    new TableRow({ children: [cell("upload_date", 2400, { mono: true }), cell("TIMESTAMP", 1600, { center: true }), cell("Fecha y hora de inicio de la carga", 5638)] }),
  ], [2400, 1600, 5638]),
  sp(),

  h3("4.1.2. jobs"),
  table([
    new TableRow({ children: [hdrCell("Columna", 2400), hdrCell("Tipo", 1600), hdrCell("Restriccion / Descripcion", 5638)] }),
    new TableRow({ children: [cell("id", 2400, { mono: true }), cell("UUID", 1600, { center: true }), cell("Clave primaria", 5638)] }),
    new TableRow({ children: [cell("dataset_id", 2400, { mono: true }), cell("UUID FK", 1600, { center: true }), cell("Referencia a datasets.id", 5638)] }),
    new TableRow({ children: [cell("model_type", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Arquitectura YOLO: yolov8n/s/m/l/x o yolo11n...yolo11x", 5638)] }),
    new TableRow({ children: [cell("model_name", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Nombre del modelo en el registro", 5638)] }),
    new TableRow({ children: [cell("config", 2400, { mono: true }), cell("JSON", 1600, { center: true }), cell("{epochs, batch_size} — parametros de entrenamiento", 5638)] }),
    new TableRow({ children: [cell("status", 2400, { mono: true }), cell("ENUM", 1600, { center: true }), cell("pending | provisioning | training | completed | failed", 5638)] }),
    new TableRow({ children: [cell("start_time", 2400, { mono: true }), cell("TIMESTAMP", 1600, { center: true }), cell("Inicio del entrenamiento en VM2", 5638)] }),
    new TableRow({ children: [cell("end_time", 2400, { mono: true }), cell("TIMESTAMP", 1600, { center: true }), cell("Fin del entrenamiento (completado o fallido)", 5638)] }),
    new TableRow({ children: [cell("celery_task_id", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("ID de la tarea Celery launch_training_job", 5638)] }),
    new TableRow({ children: [cell("error_message", 2400, { mono: true }), cell("TEXT", 1600, { center: true }), cell("Descripcion del error si status=failed", 5638)] }),
    new TableRow({ children: [cell("created_at", 2400, { mono: true }), cell("TIMESTAMP", 1600, { center: true }), cell("Fecha de creacion del trabajo", 5638)] }),
  ], [2400, 1600, 5638]),
  sp(),

  h3("4.1.3. training_metrics"),
  table([
    new TableRow({ children: [hdrCell("Columna", 2400), hdrCell("Tipo", 1600), hdrCell("Descripcion", 5638)] }),
    new TableRow({ children: [cell("id", 2400, { mono: true }), cell("UUID", 1600, { center: true }), cell("Clave primaria", 5638)] }),
    new TableRow({ children: [cell("job_id", 2400, { mono: true }), cell("UUID FK", 1600, { center: true }), cell("Referencia a jobs.id", 5638)] }),
    new TableRow({ children: [cell("epoch", 2400, { mono: true }), cell("INTEGER", 1600, { center: true }), cell("Numero de epoca (0-indexed)", 5638)] }),
    new TableRow({ children: [cell("train_loss", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("Perdida total sobre conjunto de entrenamiento", 5638)] }),
    new TableRow({ children: [cell("val_loss", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("Perdida total sobre conjunto de validacion", 5638)] }),
    new TableRow({ children: [cell("map50", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("mAP @ IoU threshold 0.50", 5638)] }),
    new TableRow({ children: [cell("map50_95", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("mAP promedio @ IoU thresholds 0.50:0.95", 5638)] }),
    new TableRow({ children: [cell("timestamp", 2400, { mono: true }), cell("TIMESTAMP", 1600, { center: true }), cell("Momento exacto del registro de la metrica", 5638)] }),
  ], [2400, 1600, 5638]),
  sp(),

  h3("4.1.4. model_versions"),
  table([
    new TableRow({ children: [hdrCell("Columna", 2400), hdrCell("Tipo", 1600), hdrCell("Descripcion", 5638)] }),
    new TableRow({ children: [cell("id", 2400, { mono: true }), cell("UUID", 1600, { center: true }), cell("Clave primaria", 5638)] }),
    new TableRow({ children: [cell("job_id", 2400, { mono: true }), cell("UUID FK", 1600, { center: true }), cell("Referencia al trabajo que genero este modelo", 5638)] }),
    new TableRow({ children: [cell("model_name", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Nombre del modelo (agrupa versiones)", 5638)] }),
    new TableRow({ children: [cell("version", 2400, { mono: true }), cell("INTEGER", 1600, { center: true }), cell("Version numerica, autoincremental por model_name", 5638)] }),
    new TableRow({ children: [cell("gcs_path", 2400, { mono: true }), cell("VARCHAR", 1600, { center: true }), cell("Ruta GCS al directorio con best.pt, last.pt, metrics.json", 5638)] }),
    new TableRow({ children: [cell("map50", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("mAP@50 del mejor checkpoint del entrenamiento", 5638)] }),
    new TableRow({ children: [cell("precision", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("Precision del mejor checkpoint", 5638)] }),
    new TableRow({ children: [cell("recall", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("Recall del mejor checkpoint", 5638)] }),
    new TableRow({ children: [cell("speed_ms", 2400, { mono: true }), cell("FLOAT", 1600, { center: true }), cell("Milisegundos por imagen en inferencia", 5638)] }),
    new TableRow({ children: [cell("is_production", 2400, { mono: true }), cell("BOOLEAN", 1600, { center: true }), cell("True si esta version es la activa en produccion", 5638)] }),
    new TableRow({ children: [cell("created_at", 2400, { mono: true }), cell("TIMESTAMP", 1600, { center: true }), cell("Fecha de registro", 5638)] }),
  ], [2400, 1600, 5638]),
  sp()
];

// ─── 5. API ENDPOINTS ─────────────────────────────────────────────────────────
const s5 = [
  h1("5. Especificacion de la API REST"),
  p("La API REST de Alpha Plus esta documentada automaticamente por FastAPI (disponible en /docs con Swagger UI). Los cuatro routers se describen a continuacion:"),
  sp(),

  h2("5.1. Router: /api/datasets"),
  table([
    new TableRow({ children: [hdrCell("Metodo", 1000), hdrCell("Endpoint", 2800), hdrCell("Descripcion", 5838)] }),
    new TableRow({ children: [cell("GET",    1000, { bold: true, color: "1A7A4A" }), cell("/mentat",           2800, { mono: true }), cell("Lista todos los datasets MENTAT disponibles en GCS", 5838)] }),
    new TableRow({ children: [cell("GET",    1000, { bold: true, color: "1A7A4A" }), cell("/manual",           2800, { mono: true }), cell("Lista datasets manuales registrados en PostgreSQL", 5838)] }),
    new TableRow({ children: [cell("POST",   1000, { bold: true, color: "1B4F72" }), cell("/upload/init",      2800, { mono: true }), cell("Inicia sesion de carga reanudable en GCS; devuelve signed URL y dataset_id", 5838)] }),
    new TableRow({ children: [cell("POST",   1000, { bold: true, color: "1B4F72" }), cell("/upload/complete",  2800, { mono: true }), cell("Notifica fin de carga; encola tarea de extraccion Celery", 5838)] }),
    new TableRow({ children: [cell("GET",    1000, { bold: true, color: "1A7A4A" }), cell("/{id}/status",      2800, { mono: true }), cell("Consulta el estado de procesamiento de un dataset (usado en polling)", 5838)] }),
    new TableRow({ children: [cell("DELETE", 1000, { bold: true, color: "922B21" }), cell("/{id}",             2800, { mono: true }), cell("Cancela o elimina un dataset pendiente o fallido", 5838)] }),
  ], [1000, 2800, 5838]),
  sp(),

  h2("5.2. Router: /api/training"),
  table([
    new TableRow({ children: [hdrCell("Metodo", 1000), hdrCell("Endpoint", 2800), hdrCell("Descripcion", 5838)] }),
    new TableRow({ children: [cell("POST",  1000, { bold: true, color: "1B4F72" }), cell("/jobs",                   2800, { mono: true }), cell("Crea y encola un nuevo trabajo de entrenamiento", 5838)] }),
    new TableRow({ children: [cell("GET",   1000, { bold: true, color: "1A7A4A" }), cell("/jobs",                   2800, { mono: true }), cell("Lista todos los trabajos (historial)", 5838)] }),
    new TableRow({ children: [cell("GET",   1000, { bold: true, color: "1A7A4A" }), cell("/jobs/{id}",              2800, { mono: true }), cell("Obtiene el detalle de un trabajo especifico", 5838)] }),
    new TableRow({ children: [cell("GET",   1000, { bold: true, color: "1A7A4A" }), cell("/jobs/{id}/metrics",      2800, { mono: true }), cell("Devuelve las metricas por epoca de un trabajo (polling frontend)", 5838)] }),
    new TableRow({ children: [cell("POST",  1000, { bold: true, color: "1B4F72" }), cell("/jobs/{id}/metrics",      2800, { mono: true }), cell("VM2 reporta metricas de la epoca actual al backend", 5838)] }),
    new TableRow({ children: [cell("PATCH", 1000, { bold: true, color: "9B59B6" }), cell("/jobs/{id}",              2800, { mono: true }), cell("VM2 actualiza el estado final del trabajo (completed/failed)", 5838)] }),
  ], [1000, 2800, 5838]),
  sp(),

  h2("5.3. Router: /api/models"),
  table([
    new TableRow({ children: [hdrCell("Metodo", 1000), hdrCell("Endpoint", 2800), hdrCell("Descripcion", 5838)] }),
    new TableRow({ children: [cell("GET",  1000, { bold: true, color: "1A7A4A" }), cell("/",                  2800, { mono: true }), cell("Lista todas las versiones de todos los modelos", 5838)] }),
    new TableRow({ children: [cell("GET",  1000, { bold: true, color: "1A7A4A" }), cell("/{model_name}",      2800, { mono: true }), cell("Lista versiones de un modelo especifico", 5838)] }),
    new TableRow({ children: [cell("POST", 1000, { bold: true, color: "1B4F72" }), cell("/",                  2800, { mono: true }), cell("Registra una nueva version de modelo (llamada desde VM2)", 5838)] }),
    new TableRow({ children: [cell("POST", 1000, { bold: true, color: "1B4F72" }), cell("/{id}/promote",      2800, { mono: true }), cell("Promueve la version a produccion (actualiza DB + GCS atomicamente)", 5838)] }),
  ], [1000, 2800, 5838]),
  sp(),

  h2("5.4. Router: /api/inference"),
  table([
    new TableRow({ children: [hdrCell("Metodo", 1000), hdrCell("Endpoint", 2800), hdrCell("Descripcion", 5838)] }),
    new TableRow({ children: [cell("GET",  1000, { bold: true, color: "1A7A4A" }), cell("/status",    2800, { mono: true }), cell("Indica si hay modelo de produccion cargado y listo", 5838)] }),
    new TableRow({ children: [cell("POST", 1000, { bold: true, color: "1B4F72" }), cell("/predict",   2800, { mono: true }), cell("Ejecuta inferencia YOLO sobre imagen; devuelve lista de detecciones", 5838)] }),
  ], [1000, 2800, 5838]),
  sp()
];

// ─── 6. COMPONENTES FRONTEND ──────────────────────────────────────────────────
const s6 = [
  h1("6. Arquitectura Frontend"),
  h2("6.1. Stack Tecnologico"),
  p("El frontend de Alpha Plus es una Single Page Application (SPA) construida con React 18 y Vite 5 como bundler. La navegacion es del lado del cliente mediante React Router v6. No se utiliza ningun framework CSS externo; los estilos son CSS vanilla."),
  sp(),

  h2("6.2. Arbol de Componentes"),
  table([
    new TableRow({ children: [hdrCell("Componente", 3000), hdrCell("Ruta", 2000), hdrCell("Responsabilidad", 4638)] }),
    new TableRow({ children: [cell("App.jsx", 3000, { bold: true }), cell("/", 2000, { mono: true }), cell("Router raiz; define estructura Sidebar + contenido principal", 4638)] }),
    new TableRow({ children: [cell("Sidebar.jsx", 3000), cell("(global)", 2000, { mono: true }), cell("Navegacion lateral entre las cuatro secciones del sistema", 4638)] }),
    new TableRow({ children: [cell("DatasetBrowser", 3000, { bold: true }), cell("/datasets", 2000, { mono: true }), cell("Gestion de datasets MENTAT y manuales; lanzamiento de cargas", 4638)] }),
    new TableRow({ children: [cell("  MentatTab", 3000), cell("", 2000), cell("Tabla de datasets importados desde MENTAT via GCS", 4638)] }),
    new TableRow({ children: [cell("  ManualTab", 3000), cell("", 2000), cell("Tabla de datasets subidos manualmente con estado de procesamiento", 4638)] }),
    new TableRow({ children: [cell("  UploadModal", 3000), cell("", 2000), cell("Modal de carga de 3 fases: SELECT -> UPLOADING (XHR + progress) -> PROCESSING (polling)", 4638)] }),
    new TableRow({ children: [cell("TrainingManager", 3000, { bold: true }), cell("/training", 2000, { mono: true }), cell("Formulario de configuracion de trabajos e historial con metricas en vivo", 4638)] }),
    new TableRow({ children: [cell("  LaunchForm", 3000), cell("", 2000), cell("Seleccion de dataset, modelo, nombre, epocas y batch_size", 4638)] }),
    new TableRow({ children: [cell("  JobHistory", 3000), cell("", 2000), cell("Tabla de trabajos con estado, duracion y enlace a metricas; polling 10s en trabajos activos", 4638)] }),
    new TableRow({ children: [cell("ModelRegistry", 3000, { bold: true }), cell("/models", 2000, { mono: true }), cell("Lista de versiones de modelo con metricas; boton de promocion a produccion", 4638)] }),
    new TableRow({ children: [cell("InferenceDemo", 3000, { bold: true }), cell("/inference", 2000, { mono: true }), cell("Subida de imagen y visualizacion de detecciones YOLO sobre el modelo activo", 4638)] }),
  ], [3000, 2000, 4638]),
  sp(),

  h2("6.3. Cliente API (src/api/client.js)"),
  p("Todas las llamadas HTTP del frontend pasan por el modulo client.js, que centraliza las URLs base, los headers y el manejo de errores. Los grupos de funciones son:"),
  bullet("datasetsApi: listMentat, listManual, initUpload, completeUpload, getStatus, cancel."),
  bullet("trainingApi: createJob, listJobs, getJob, getMetrics."),
  bullet("modelsApi: list, listByName, promote."),
  bullet("inferenceApi: status, predict."),
  p("Las cargas de fichero se realizan con XMLHttpRequest (en lugar de fetch) para soportar tracking de progreso nativo (xhr.upload.onprogress). El frontend calcula velocidad de carga en tiempo real y estima el tiempo restante (ETA)."),
  sp(),

  h2("6.4. Estrategia de Polling"),
  table([
    new TableRow({ children: [hdrCell("Contexto", 3000), hdrCell("Intervalo", 1800), hdrCell("Condicion de parada", 4838)] }),
    new TableRow({ children: [cell("Estado de dataset en extraccion", 3000), cell("5 segundos", 1800, { center: true }), cell("status in {ready, failed}", 4838)] }),
    new TableRow({ children: [cell("Estado de trabajo de entrenamiento", 3000), cell("10 segundos", 1800, { center: true }), cell("status in {completed, failed}", 4838)] }),
    new TableRow({ children: [cell("Metricas de entrenamiento (epocas)", 3000), cell("10 segundos", 1800, { center: true }), cell("Trabajo completado o fallido", 4838)] }),
    new TableRow({ children: [cell("Grace period en trabajos activos", 3000), cell("30 segundos", 1800, { center: true }), cell("Transicion de estado observada", 4838)] }),
  ], [3000, 1800, 4838]),
  sp()
];

// ─── 7. SERVICIOS Y TAREAS ────────────────────────────────────────────────────
const s7 = [
  h1("7. Servicios de Infraestructura y Tareas Asincronas"),
  h2("7.1. gcs_client.py — Abstraccion de Google Cloud Storage"),
  p("El modulo gcs_client.py encapsula todas las operaciones contra GCS. Utiliza un patron de inicializacion lazy del cliente GCP para evitar cargas en el arranque:"),
  table([
    new TableRow({ children: [hdrCell("Funcion", 3200), hdrCell("Descripcion", 6438)] }),
    new TableRow({ children: [cell("list_mentat_datasets()", 3200, { mono: true }), cell("Enumera proyectos y timestamps en gs://bucket/datasets/; lee metadata.json de cada uno", 6438)] }),
    new TableRow({ children: [cell("create_resumable_upload_session()", 3200, { mono: true }), cell("Crea una URL de carga reanudable firmada para temp-uploads/ con TTL configurable", 6438)] }),
    new TableRow({ children: [cell("download_temp_zip(upload_id, dest)", 3200, { mono: true }), cell("Descarga streaming del ZIP desde temp-uploads/ al disco de extraccion", 6438)] }),
    new TableRow({ children: [cell("upload_directory(local_dir, gcs_prefix)", 3200, { mono: true }), cell("Sube un directorio completo a GCS en paralelo con ThreadPoolExecutor (16 workers)", 6438)] }),
    new TableRow({ children: [cell("upload_file(local_path, gcs_path)", 3200, { mono: true }), cell("Sube un fichero individual a GCS", 6438)] }),
    new TableRow({ children: [cell("upload_text(content, gcs_path)", 3200, { mono: true }), cell("Sube contenido de texto (YAML, JSON) como blob", 6438)] }),
    new TableRow({ children: [cell("get_model_versions(model_name)", 3200, { mono: true }), cell("Lista versiones disponibles en gs://bucket/models/{name}/v*/", 6438)] }),
    new TableRow({ children: [cell("read_production_pointer(model_name)", 3200, { mono: true }), cell("Lee production.json de GCS (puede ser None si no hay version de produccion)", 6438)] }),
    new TableRow({ children: [cell("write_production_pointer(model_name, data)", 3200, { mono: true }), cell("Escritura atomica de production.json con If-Generation-Match para prevenir race conditions", 6438)] }),
    new TableRow({ children: [cell("delete_temp_zip(upload_id)", 3200, { mono: true }), cell("Elimina el ZIP temporal tras la extraccion exitosa", 6438)] }),
  ], [3200, 6438]),
  sp(),

  h2("7.2. vm_lifecycle.py — Gestion de la VM GPU"),
  p("El modulo vm_lifecycle.py encapsula las llamadas a la API de Google Compute Engine para controlar el ciclo de vida de VM2. Todas las operaciones son asincronas y esperan a la finalizacion de la operacion GCP antes de retornar:"),
  table([
    new TableRow({ children: [hdrCell("Funcion", 3000), hdrCell("Descripcion", 6638)] }),
    new TableRow({ children: [cell("start_training_vm()", 3000, { mono: true }), cell("Llama a instances.start() sobre la instancia GPU configurada; espera a que la operacion GCP complete", 6638)] }),
    new TableRow({ children: [cell("stop_training_vm()", 3000, { mono: true }), cell("Llama a instances.stop(); util para paradas de emergencia desde el backend", 6638)] }),
    new TableRow({ children: [cell("get_vm_status()", 3000, { mono: true }), cell("Obtiene el estado actual de la instancia: RUNNING, TERMINATED, STAGING, STOPPING, etc.", 6638)] }),
    new TableRow({ children: [cell("is_vm_running()", 3000, { mono: true }), cell("Booleano de conveniencia: True si get_vm_status() == RUNNING", 6638)] }),
    new TableRow({ children: [cell("set_vm_metadata(key_value_dict)", 3000, { mono: true }), cell("Actualiza metadatos de instancia atomicamente (fingerprint + apply) para pasar job_id y api_url a VM2", 6638)] }),
  ], [3000, 6638]),
  sp(),

  h2("7.3. Colas Celery"),
  p("El sistema define dos workers Celery con configuraciones distintas:"),
  table([
    new TableRow({ children: [hdrCell("Cola", 2000), hdrCell("Concurrencia", 1600), hdrCell("Tareas asignadas", 3200), hdrCell("Razon de la configuracion", 2838)] }),
    new TableRow({ children: [
      cell("dataset_extraction", 2000, { mono: true }),
      cell("1", 1600, { center: true }),
      cell("extract_dataset_zip", 3200, { mono: true }),
      cell("Evita contention de disco en el volumen de extraccion de 150 GB", 2838)
    ]}),
    new TableRow({ children: [
      cell("vm_lifecycle", 2000, { mono: true }),
      cell("4", 1600, { center: true }),
      cell("launch_training_job", 3200, { mono: true }),
      cell("Permite gestionar hasta 4 ciclos de VM simultaneos sin bloqueos en el polling", 2838)
    ]}),
  ], [2000, 1600, 3200, 2838]),
  sp()
];

// ─── 8. TECNOLOGIAS ───────────────────────────────────────────────────────────
const s8 = [
  h1("8. Tecnologias e Implementaciones"),
  h2("8.1. Stack Tecnologico Completo"),
  table([
    new TableRow({ children: [hdrCell("Categoria", 2200), hdrCell("Tecnologia", 2400), hdrCell("Version", 1200), hdrCell("Rol en el sistema", 3838)] }),
    // Backend
    new TableRow({ children: [cell("Backend framework",   2200, { bold: true, fill: C.rowAlt }), cell("FastAPI",            2400), cell("0.111.0", 1200, { center: true }), cell("API REST, validacion de schemas (Pydantic), documentacion automatica Swagger", 3838)] }),
    new TableRow({ children: [cell("Servidor ASGI",       2200, { bold: true, fill: C.rowAlt }), cell("Uvicorn",            2400), cell("0.29.0",  1200, { center: true }), cell("Servidor asincrono de alto rendimiento para FastAPI", 3838)] }),
    new TableRow({ children: [cell("ORM",                 2200, { bold: true, fill: C.rowAlt }), cell("SQLAlchemy",         2400), cell("2.0.30",  1200, { center: true }), cell("Mapeo objeto-relacional sobre PostgreSQL, sesiones y migraciones", 3838)] }),
    new TableRow({ children: [cell("Base de datos",       2200, { bold: true, fill: C.rowAlt }), cell("PostgreSQL",         2400), cell("16-alpine",1200, { center: true }), cell("Persistencia de estado: datasets, jobs, metricas, model versions", 3838)] }),
    new TableRow({ children: [cell("Broker / Cache",      2200, { bold: true, fill: C.rowAlt }), cell("Redis",              2400), cell("7-alpine", 1200, { center: true }), cell("Broker de mensajes para Celery; backend de resultados de tareas", 3838)] }),
    new TableRow({ children: [cell("Cola de tareas",      2200, { bold: true, fill: C.rowAlt }), cell("Celery",             2400), cell("5.4.0",   1200, { center: true }), cell("Tareas asincronas: extraccion de datasets y gestion del ciclo de vida GPU", 3838)] }),
    new TableRow({ children: [cell("Almacenamiento",      2200, { bold: true, fill: C.rowAlt }), cell("Google Cloud Storage",2400), cell("2.16.0",  1200, { center: true }), cell("Repositorio central de datasets, modelos y configuraciones de jobs", 3838)] }),
    new TableRow({ children: [cell("Compute API",         2200, { bold: true, fill: C.rowAlt }), cell("google-api-python-client",2400), cell("2.129.0",1200, { center: true }), cell("Control programatico del ciclo de vida de VM2 (start/stop/status/metadata)", 3838)] }),
    // ML
    new TableRow({ children: [cell("ML Training",         2200, { bold: true, fill: C.lightBg }), cell("Ultralytics YOLO",  2400), cell(">=8.3.0", 1200, { center: true }), cell("Motor de entrenamiento e inferencia YOLO (YOLOv8 y YOLO11)", 3838)] }),
    new TableRow({ children: [cell("Vision computacional",2200, { bold: true, fill: C.lightBg }), cell("OpenCV (headless)", 2400), cell("latest",  1200, { center: true }), cell("Procesamiento de imagenes pre y post inferencia en train_worker.py", 3838)] }),
    new TableRow({ children: [cell("Procesamiento imagen",2200, { bold: true, fill: C.lightBg }), cell("Pillow",            2400), cell("10.3.0",  1200, { center: true }), cell("Carga y manipulacion de imagenes en el backend para el endpoint de inferencia", 3838)] }),
    // Frontend
    new TableRow({ children: [cell("Frontend framework",  2200, { bold: true, fill: C.rowAlt }), cell("React",             2400), cell("18.3.1",  1200, { center: true }), cell("SPA reactiva con componentes funcionales y hooks", 3838)] }),
    new TableRow({ children: [cell("Build tool",          2200, { bold: true, fill: C.rowAlt }), cell("Vite",              2400), cell("5.2.0",   1200, { center: true }), cell("Compilacion, HMR y optimizacion del bundle frontend", 3838)] }),
    new TableRow({ children: [cell("Routing",             2200, { bold: true, fill: C.rowAlt }), cell("React Router",      2400), cell("6.23.1",  1200, { center: true }), cell("Navegacion declarativa client-side entre las 4 secciones", 3838)] }),
    // Infraestructura
    new TableRow({ children: [cell("Reverse proxy",       2200, { bold: true, fill: C.lightBg }), cell("Nginx",            2400), cell("alpine",  1200, { center: true }), cell("Enrutado /api/ -> FastAPI, / -> Vite; soporte WebSocket HMR; timeouts 300s", 3838)] }),
    new TableRow({ children: [cell("Contenedores",        2200, { bold: true, fill: C.lightBg }), cell("Docker + Compose", 2400), cell("3.9",     1200, { center: true }), cell("Orquestacion de los 7 servicios de VM1 (nginx, frontend, backend, 2 workers, db, redis)", 3838)] }),
    new TableRow({ children: [cell("Configuracion",       2200, { bold: true, fill: C.lightBg }), cell("Pydantic Settings",2400), cell("2.2.1",   1200, { center: true }), cell("Carga y validacion de variables de entorno (.env)", 3838)] }),
    new TableRow({ children: [cell("YAML",                2200, { bold: true, fill: C.lightBg }), cell("PyYAML",           2400), cell("6.0.1",   1200, { center: true }), cell("Lectura y generacion de archivos data.yaml de configuracion YOLO", 3838)] }),
  ], [2200, 2400, 1200, 3838]),
  sp(),

  h2("8.2. Patrones de Implementacion Destacados"),
  h3("8.2.1. Upload directo a GCS (bypass del servidor)"),
  p("La carga de datasets omite deliberadamente el servidor de aplicacion. El backend genera una URL de sesion reanudable firmada de GCS y el navegador sube el fichero directamente al bucket mediante XHR. Este patron permite cargas de hasta 20 GB sin saturar la red de VM1 ni su memoria."),
  sp(),

  h3("8.2.2. Escritura atomica de production.json"),
  p("La promocion de un modelo a produccion escribe un puntero JSON en GCS usando condiciones de generacion (If-Generation-Match). Si el archivo ha cambiado entre la lectura y la escritura, la operacion falla con un conflicto 412 y debe reintentarse. Este patron evita race conditions cuando dos usuarios promueven modelos simultanuamente."),
  sp(),

  h3("8.2.3. Auto-shutdown de la VM GPU"),
  p("VM2 implementa una doble garantia de apagado: un trap de salida en startup.sh que invoca gcloud compute instances stop $(hostname) ante cualquier condicion de salida del proceso principal, y una llamada explicita al mismo comando al final de train_worker.py. Esto garantiza que la VM GPU nunca permanezca activa innecesariamente, independientemente de si el entrenamiento termina con exito, error o interrupcion."),
  sp(),

  h3("8.2.4. Deteccion automatica de layout YOLO"),
  p("La tarea de extraccion determina el formato del ZIP sin intervension del usuario mediante inspeccion del arbol de directorios. Soporta tres layouts: split (ya tiene train/ y val/), nested (estructura con prefijos intermedios) y flat (todos los ficheros en raiz). Los dos ultimos se normalizan automaticamente al formato split canonico antes de la carga a GCS."),
  sp(),

  h3("8.2.5. Validacion de etiquetas por muestreo"),
  p("Validar el 100% de las etiquetas de un dataset grande seria prohibitivo en tiempo. La tarea extrae y valida el 5% de los archivos .txt mediante muestreo aleatorio, verificando que el class_id sea menor que el numero de clases declarado en data.yaml y que todas las coordenadas de bounding box esten en el rango normalizado [0.0, 1.0]."),
  sp()
];

// ─── 9. INFRAESTRUCTURA Y DESPLIEGUE ─────────────────────────────────────────
const s9 = [
  h1("9. Infraestructura y Despliegue"),
  h2("9.1. Servicios Docker Compose (VM1)"),
  table([
    new TableRow({ children: [hdrCell("Servicio", 1800), hdrCell("Imagen base", 2200), hdrCell("Puerto", 1000), hdrCell("Responsabilidad", 4638)] }),
    new TableRow({ children: [cell("nginx",      1800, { bold: true }), cell("nginx:alpine",     2200, { mono: true }), cell(":80",   1000, { center: true }), cell("Reverse proxy; enruta /api/ y /health/ a backend:8000, el resto a frontend:5173", 4638)] }),
    new TableRow({ children: [cell("frontend",   1800, { bold: true }), cell("node:18-alpine",   2200, { mono: true }), cell(":5173", 1000, { center: true }), cell("Vite dev server; HMR via WebSocket; sirve la SPA React", 4638)] }),
    new TableRow({ children: [cell("backend",    1800, { bold: true }), cell("python:3.11-slim", 2200, { mono: true }), cell(":8000", 1000, { center: true }), cell("FastAPI + Uvicorn; API REST; acceso a DB, Redis y GCS", 4638)] }),
    new TableRow({ children: [cell("worker",     1800, { bold: true }), cell("python:3.11-slim", 2200, { mono: true }), cell("—",     1000, { center: true }), cell("Celery worker cola dataset_extraction (concurrencia=1)", 4638)] }),
    new TableRow({ children: [cell("worker_vm",  1800, { bold: true }), cell("python:3.11-slim", 2200, { mono: true }), cell("—",     1000, { center: true }), cell("Celery worker cola vm_lifecycle (concurrencia=4)", 4638)] }),
    new TableRow({ children: [cell("db",         1800, { bold: true }), cell("postgres:16-alpine",2200, { mono: true }), cell(":5432", 1000, { center: true }), cell("PostgreSQL 16; datos persistidos en volumen Docker postgres_data", 4638)] }),
    new TableRow({ children: [cell("redis",      1800, { bold: true }), cell("redis:7-alpine",   2200, { mono: true }), cell(":6379", 1000, { center: true }), cell("Redis 7; broker Celery y backend de resultados de tareas", 4638)] }),
  ], [1800, 2200, 1000, 4638]),
  sp(),

  h2("9.2. Volumenes Docker"),
  table([
    new TableRow({ children: [hdrCell("Volumen", 3000), hdrCell("Punto de montaje", 2400), hdrCell("Descripcion", 4238)] }),
    new TableRow({ children: [cell("extraction_scratch", 3000, { mono: true }), cell("/data/extraction", 2400, { mono: true }), cell("Disco persistente de 150 GB para extraccion temporal de ZIPs. Compartido entre backend y worker.", 4238)] }),
    new TableRow({ children: [cell("postgres_data",      3000, { mono: true }), cell("/var/lib/postgresql/data", 2400, { mono: true }), cell("Datos persistentes de PostgreSQL. Sobrevive reinicios del contenedor.", 4238)] }),
  ], [3000, 2400, 4238]),
  sp(),

  h2("9.3. Variables de Entorno Criticas (.env)"),
  table([
    new TableRow({ children: [hdrCell("Variable", 3200), hdrCell("Descripcion", 6438)] }),
    new TableRow({ children: [cell("DATABASE_URL",                  3200, { mono: true }), cell("Cadena de conexion SQLAlchemy a PostgreSQL (incluye usuario, password, host, db)", 6438)] }),
    new TableRow({ children: [cell("REDIS_URL",                     3200, { mono: true }), cell("URL de conexion al broker Redis (redis://redis:6379/0)", 6438)] }),
    new TableRow({ children: [cell("GCS_BUCKET",                    3200, { mono: true }), cell("Nombre del bucket GCS donde se almacenan datasets y modelos", 6438)] }),
    new TableRow({ children: [cell("GOOGLE_APPLICATION_CREDENTIALS",3200, { mono: true }), cell("Ruta al JSON de la cuenta de servicio GCP con permisos GCS y Compute Engine", 6438)] }),
    new TableRow({ children: [cell("GCP_PROJECT",                   3200, { mono: true }), cell("ID del proyecto GCP", 6438)] }),
    new TableRow({ children: [cell("GCP_ZONE",                      3200, { mono: true }), cell("Zona GCP de VM2 (p.ej. us-central1-a)", 6438)] }),
    new TableRow({ children: [cell("GPU_VM_NAME",                   3200, { mono: true }), cell("Nombre de la instancia GPU en GCP (p.ej. alphaplus-trainer)", 6438)] }),
    new TableRow({ children: [cell("MAX_UPLOAD_SIZE_BYTES",         3200, { mono: true }), cell("Limite maximo de tamano de ZIP (por defecto 21474836480 = 20 GB)", 6438)] }),
    new TableRow({ children: [cell("EXTRACTION_PATH",               3200, { mono: true }), cell("Directorio de extraccion temporal en disco persistente (/data/extraction)", 6438)] }),
    new TableRow({ children: [cell("CORS_ORIGINS",                  3200, { mono: true }), cell("Origenes permitidos para CORS (lista separada por comas)", 6438)] }),
  ], [3200, 6438]),
  sp()
];

// ─── ASSEMBLY ─────────────────────────────────────────────────────────────────
const children = [
  ...cover,
  ...toc,
  ...s1,
  pb(),
  ...s2,
  pb(),
  ...s3,
  pb(),
  ...s4,
  pb(),
  ...s5,
  pb(),
  ...s6,
  pb(),
  ...s7,
  pb(),
  ...s8,
  pb(),
  ...s9,
];

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "-", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 640, hanging: 320 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "o", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1200, hanging: 320 } } } },
        ]
      },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 640, hanging: 320 } } } }]
      },
      { reference: "numbers2",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1200, hanging: 320 } } } }]
      },
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20, color: C.gray } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 34, bold: true, font: "Arial", color: C.darkBlue },
        paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: C.midBlue },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: C.accent },
        paragraph: { spacing: { before: 220, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: page,
        margin
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 4 } },
          children: [
            new TextRun({ text: "ALPHA PLUS v0.1  |  Documento Tecnico de Software", size: 16, font: "Arial", color: C.muted }),
            new TextRun("\t"),
            new TextRun({ text: "Privado y Confidencial", size: 16, font: "Arial", color: C.muted, italics: true }),
          ],
          tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.TabStopPosition.MAX }]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 4 } },
          children: [
            new TextRun({ text: "Alpha Plus — Fabrica de Modelos YOLO Industrial", size: 16, font: "Arial", color: C.muted }),
            new TextRun("\t"),
            new TextRun({ text: "Pagina ", size: 16, font: "Arial", color: C.muted }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: C.muted }),
          ],
          tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.TabStopPosition.MAX }]
        })]
      })
    },
    children
  }]
});

const outPath = "C:/Users/Alexis/Downloads/AlphaPlus_Documento_Tecnico_Pipeline.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("Generado:", outPath);
}).catch(e => { console.error(e.message); process.exit(1); });
