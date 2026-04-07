/**
 * Generator: Fábrica de Modelos de IA Industrial — Documento Técnico I+D Europeo
 * Output: C:\Users\Alexis\Downloads\Fabrica_Modelos_IA_Industrial.docx
 */

"use strict";

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, TableLayoutType,
  Header, Footer, PageNumber, NumberFormat, convertInchesToTwip,
  LevelFormat, UnderlineType, PageBreak, Tab, TabStopPosition, TabStopType,
  LineRuleType,
} = require("C:/nvm4w/nodejs/node_modules/docx");

const fs = require("fs");

// ─── colour palette ────────────────────────────────────────────────────────────
const C = {
  navy:      "003366",   // headings
  teal:      "006666",   // h2
  darkGrey:  "333333",   // body text
  midGrey:   "555555",
  lightGrey: "F2F2F2",   // table header shading
  accent:    "0070C0",   // links / code accent
  codeGrey:  "F5F5F5",
  white:     "FFFFFF",
  red:       "CC0000",
};

// ─── helpers ───────────────────────────────────────────────────────────────────

function spacingPara(spaceBefore = 0, spaceAfter = 160) {
  return { before: spaceBefore, after: spaceAfter, line: 276, lineRule: LineRuleType.AUTO };
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    thematicBreak: false,
    spacing: { before: 400, after: 160 },
    run: {
      bold: true,
      color: C.navy,
      size: 36,
    },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 120 },
    run: {
      bold: true,
      color: C.teal,
      size: 30,
    },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 80 },
    run: {
      bold: true,
      color: C.navy,
      size: 26,
    },
  });
}

function h4(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 200, after: 80 },
    run: {
      bold: true,
      color: C.teal,
      size: 24,
    },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        color: opts.color || C.darkGrey,
        size: opts.size || 22,
        bold: opts.bold || false,
        italics: opts.italics || false,
      }),
    ],
    spacing: spacingPara(opts.spaceBefore || 0, opts.spaceAfter || 160),
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}

function bold(text, size = 22) {
  return new TextRun({ text, bold: true, color: C.darkGrey, size });
}

function italic(text, size = 22) {
  return new TextRun({ text, italics: true, color: C.midGrey, size });
}

function code(text) {
  return new TextRun({ text, font: "Courier New", color: C.accent, size: 20 });
}

function mixed(runs, opts = {}) {
  return new Paragraph({
    children: runs,
    spacing: spacingPara(opts.spaceBefore || 0, opts.spaceAfter || 160),
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}

function bullet(text, level = 0) {
  const indent = 360 + level * 360;
  return new Paragraph({
    children: [
      new TextRun({ text: "- " + text, color: C.darkGrey, size: 22 }),
    ],
    spacing: { before: 40, after: 40, line: 276, lineRule: LineRuleType.AUTO },
    indent: { left: indent, hanging: 360 },
  });
}

function codeBlock(lines) {
  return lines.map(line =>
    new Paragraph({
      children: [new TextRun({ text: line, font: "Courier New", size: 18, color: "1F1F1F" })],
      shading: { type: ShadingType.CLEAR, color: "auto", fill: C.codeGrey },
      spacing: { before: 10, after: 10, line: 240, lineRule: LineRuleType.AUTO },
      indent: { left: 360 },
    })
  );
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function separator() {
  return new Paragraph({
    thematicBreak: true,
    spacing: { before: 200, after: 200 },
  });
}

function label(text) {
  return mixed([
    new TextRun({ text, bold: true, color: C.navy, size: 22, underline: { type: UnderlineType.SINGLE } }),
  ], { spaceBefore: 120, spaceAfter: 60 });
}

// ─── table helpers ─────────────────────────────────────────────────────────────

const STD_BORDERS = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  left:   { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  right:  { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
  insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
};

function tCell(text, opts = {}) {
  const isHeader = opts.header || false;
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({
        text,
        bold: isHeader || opts.bold || false,
        color: isHeader ? C.white : (opts.color || C.darkGrey),
        size: opts.size || 20,
      })],
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
    })],
    shading: isHeader
      ? { type: ShadingType.CLEAR, color: "auto", fill: C.navy }
      : (opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined),
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: opts.colSpan || undefined,
    rowSpan: opts.rowSpan || undefined,
  });
}

function tRow(cells) {
  return new TableRow({ children: cells });
}

function makeTable(rows, opts = {}) {
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: STD_BORDERS,
    margins: opts.margins || undefined,
  });
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────────

function coverPage() {
  return [
    new Paragraph({ spacing: { before: 1200, after: 0 } }),
    new Paragraph({
      children: [new TextRun({
        text: "EXPAI SmartIndustry — EUREKA 21028",
        bold: false,
        color: C.teal,
        size: 22,
        allCaps: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({ spacing: { before: 0, after: 240 } }),
    new Paragraph({
      children: [new TextRun({
        text: "Fábrica de Modelos",
        bold: true,
        color: C.navy,
        size: 64,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: "de IA Industrial",
        bold: true,
        color: C.navy,
        size: 64,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: "Documento Técnico de Arquitectura e Implementación",
        color: C.midGrey,
        size: 28,
        italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({ spacing: { before: 0, after: 480 } }),
    // Meta table
    makeTable([
      tRow([
        tCell("Referencia del proyecto", { header: true, width: 35 }),
        tCell("EXPAI SmartIndustry — EUREKA 21028", { width: 65 }),
      ]),
      tRow([
        tCell("Componente", { header: true, width: 35 }),
        tCell("Fábrica de Modelos de IA Industrial", { width: 65 }),
      ]),
      tRow([
        tCell("Versión del documento", { header: true, width: 35 }),
        tCell("1.0", { width: 65 }),
      ]),
      tRow([
        tCell("Fecha", { header: true, width: 35 }),
        tCell("Marzo 2026", { width: 65 }),
      ]),
      tRow([
        tCell("Clasificacion", { header: true, width: 35 }),
        tCell("PRIVADO Y CONFIDENCIAL", { width: 65, bold: true, color: C.red }),
      ]),
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 1: Resumen Ejecutivo ─────────────────────────────────────────────

function s1() {
  return [
    h1("1. Resumen Ejecutivo"),
    body(
      "La Fábrica de Modelos de IA Industrial es una plataforma software de entrenamiento, " +
      "evaluación y despliegue de modelos de visión artificial desarrollada en el marco del " +
      "proyecto de I+D europeo EXPAI SmartIndustry (programa EUREKA, referencia 21028). " +
      "El objetivo del sistema es proporcionar una infraestructura tecnológica completa que " +
      "permita a ingenieros y técnicos industriales generar modelos de detección de objetos " +
      "de alta precisión a partir de datasets etiquetados, sin necesidad de conocimientos " +
      "avanzados en aprendizaje automático ni gestión de infraestructura cloud."
    ),
    body(
      "El sistema opera como una factoría de modelos completamente automatizada: recibe " +
      "datasets en formato YOLO —ya sea exportados desde la plataforma de etiquetado MENTAT " +
      "o subidos manualmente por el usuario—, los valida semánticamente, los normaliza a una " +
      "estructura canónica, ejecuta el entrenamiento sobre hardware GPU en Google Cloud Platform " +
      "y publica los pesos resultantes como un endpoint de inferencia REST listo para integración " +
      "en sistemas de inspección industrial en producción."
    ),
    body(
      "La arquitectura implementa un modelo de dos VMs con separación explícita entre " +
      "infraestructura de aplicación (VM1, activa permanentemente) e infraestructura de " +
      "entrenamiento (VM2 con GPU, activa únicamente durante el ciclo de entrenamiento). " +
      "Este diseño reduce el coste operativo de la GPU en más de un 95% respecto a un " +
      "despliegue convencional con instancias GPU permanentes, al tiempo que mantiene " +
      "disponibilidad continua de la API de inferencia y la interfaz de usuario."
    ),
    body(
      "El stack tecnológico combina herramientas de código abierto consolidadas (FastAPI, " +
      "React, PostgreSQL, Celery, Redis, Docker) con la infraestructura gestionada de Google " +
      "Cloud Platform (Compute Engine, Cloud Storage) y la librería Ultralytics YOLO para " +
      "el entrenamiento de modelos de detección de objetos de estado del arte."
    ),
    body(
      "Este documento describe en detalle la arquitectura del sistema, el pipeline de datos, " +
      "los módulos funcionales, el modelo de datos relacional, la API REST y las decisiones " +
      "técnicas de diseño adoptadas durante el desarrollo."
    ),
    pageBreak(),
  ];
}

// ─── SECTION 2: Contexto del Proyecto ────────────────────────────────────────

function s2() {
  return [
    h1("2. Contexto del Proyecto I+D"),
    h2("2.1 Programa EUREKA y el proyecto EXPAI"),
    body(
      "El programa EUREKA es la principal iniciativa intergubernamental europea de financiación " +
      "de proyectos de I+D de mercado. Fomenta la colaboración entre empresas y centros de " +
      "investigación europeos para el desarrollo de tecnologías de alto impacto con aplicación " +
      "industrial directa. El proyecto EXPAI SmartIndustry (referencia EUREKA 21028) fue " +
      "seleccionado en el marco de este programa por su enfoque en la integración de " +
      "inteligencia artificial interpretable en procesos de inspección y control de calidad industrial."
    ),
    body(
      "EXPAI SmartIndustry propone el desarrollo de una suite integrada de herramientas de IA " +
      "que abarca todo el ciclo de vida del modelo de inspección visual: desde la captura y " +
      "etiquetado de imágenes industriales hasta el despliegue de modelos en líneas de " +
      "producción, pasando por el entrenamiento, la evaluación y la interpretabilidad de los " +
      "resultados. La suite se articula en torno a tres componentes principales:"
    ),
    bullet("MENTAT: plataforma web de etiquetado colaborativo de imágenes para visión artificial industrial."),
    bullet("Fábrica de Modelos de IA Industrial: plataforma de entrenamiento y despliegue de modelos YOLO (objeto de este documento)."),
    bullet("Motor de Inferencia e Interpretabilidad: servicio REST de inferencia en producción con capacidades de explicabilidad de predicciones (XAI)."),

    h2("2.2 Rol de la Fábrica de Modelos en el ecosistema EXPAI"),
    body(
      "La Fábrica de Modelos constituye el componente central del ciclo de vida del modelo " +
      "dentro del ecosistema EXPAI. Su función es consumir los datasets de entrenamiento " +
      "producidos por MENTAT, transformarlos si es necesario, entrenar modelos YOLO sobre " +
      "ellos en hardware GPU en la nube y hacer disponibles los pesos resultantes tanto para " +
      "su uso en el Motor de Inferencia como para su descarga directa por parte del equipo " +
      "de ingeniería."
    ),
    body(
      "El acoplamiento entre componentes del ecosistema EXPAI se realiza exclusivamente a " +
      "través de Google Cloud Storage, que actúa como bus de datos asíncrono. Este diseño " +
      "garantiza independencia de despliegue entre plataformas y permite que cada componente " +
      "evolucione de forma autónoma sin necesidad de coordinar versiones de API ni despliegues " +
      "simultáneos."
    ),
    new Paragraph({ spacing: { before: 120, after: 80 } }),
    body("Diagrama de integración del ecosistema EXPAI:", { bold: true }),
    ...codeBlock([
      "",
      "  [MENTAT]                   [GCS]                [Fabrica de Modelos]",
      "  Etiquetado  ──datasets──▶  gs://bucket/    ◀──lee──  Training Manager",
      "  colaborativo               datasets/               |",
      "                             │                       └──entrena YOLO (VM2)",
      "                             │                       |",
      "                             └──modelos──▶  models/  └──publica modelo",
      "                                            │",
      "  [Motor de Inferencia] ◀──best.pt──────────┘",
      "",
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 3: Arquitectura ──────────────────────────────────────────────────

function s3() {
  return [
    h1("3. Arquitectura del Sistema"),
    h2("3.1 Vision general"),
    body(
      "La arquitectura del sistema se basa en el principio de separación de responsabilidades " +
      "entre la capa de aplicación y la capa de cómputo intensivo. El componente de aplicación " +
      "gestiona la interfaz de usuario, la lógica de negocio, la persistencia de datos y la " +
      "orquestación de trabajos; el componente de cómputo ejecuta las cargas de trabajo de " +
      "entrenamiento GPU bajo demanda y se desactiva automáticamente al completarlas."
    ),
    body(
      "Este diseño responde a la naturaleza fundamentalmente asíncrona y discontinua del " +
      "entrenamiento de modelos de machine learning: los ciclos de entrenamiento tienen " +
      "duración variable (minutos a horas), no requieren intervención humana durante su " +
      "ejecución y son relativamente infrecuentes en comparación con la actividad de " +
      "consulta y gestión de la plataforma. Mantener una GPU activa permanentemente para " +
      "absorber cargas de trabajo episódicas resultaría en un uso ineficiente de recursos " +
      "costosos. El modelo de auto-aprovisionamiento elegido resuelve este problema de forma " +
      "elegante y económicamente eficiente."
    ),
    h2("3.2 Infraestructura de dos VMs en Google Cloud Platform"),
    h3("3.2.1 VM1 — Servidor de Aplicación"),
    body(
      "VM1 es la única instancia permanentemente activa del sistema. Aloja todos los " +
      "servicios de aplicación, la base de datos relacional y el sistema de colas de tareas. " +
      "Su configuración de hardware (4 vCPU, 16 GB RAM, sin GPU) está dimensionada para las " +
      "cargas de trabajo que tiene asignadas: servir peticiones HTTP, gestionar el ciclo de " +
      "vida de los trabajos de entrenamiento y procesar la extracción y validación de datasets."
    ),
    makeTable([
      tRow([tCell("Parametro", { header: true }), tCell("Valor", { header: true })]),
      tRow([tCell("Tipo de maquina GCP"), tCell("e2-standard-4 (4 vCPU, 16 GB RAM)")]),
      tRow([tCell("GPU"), tCell("Ninguna")]),
      tRow([tCell("Almacenamiento"), tCell("Disco de arranque 50 GB + Disco de datos persistente 150 GB (/data/extraction)")]),
      tRow([tCell("Coste estimado"), tCell("~$0.05-0.10 USD/hora (activa 24/7)")]),
      tRow([tCell("Sistema operativo"), tCell("Debian 11 / Ubuntu 22.04 LTS")]),
      tRow([tCell("Rol"), tCell("Frontend, API REST, Base de datos, Orquestacion de jobs, Proxy HTTP")]),
    ]),
    new Paragraph({ spacing: { before: 160, after: 80 } }),
    body("Servicios gestionados mediante Docker Compose (7 contenedores):", { bold: true }),
    makeTable([
      tRow([tCell("Servicio", { header: true }), tCell("Imagen base", { header: true }), tCell("Funcion", { header: true })]),
      tRow([tCell("nginx"),    tCell("nginx:alpine"),              tCell("Reverse proxy en puerto 80; enruta /api/ al backend y / al frontend static build")]),
      tRow([tCell("frontend"), tCell("node:20-alpine (build)"),    tCell("Aplicacion React 18 + Vite. En produccion, los assets estaticos son servidos por Nginx")]),
      tRow([tCell("backend"),  tCell("python:3.11-slim"),          tCell("FastAPI + Uvicorn. Logica de negocio, cliente GCS, API de lifecycle de VM2")]),
      tRow([tCell("worker"),   tCell("python:3.11-slim"),          tCell("Celery worker — pool dataset_extraction (concurrencia=1). Extraccion y validacion de ZIPs")]),
      tRow([tCell("worker_vm"),tCell("python:3.11-slim"),          tCell("Celery worker — pool vm_lifecycle (concurrencia=4). Gestion del ciclo de vida de VM2")]),
      tRow([tCell("db"),       tCell("postgres:16-alpine"),        tCell("PostgreSQL 16. Almacena metadatos de datasets, jobs, metricas y versiones de modelos")]),
      tRow([tCell("redis"),    tCell("redis:7-alpine"),            tCell("Redis 7. Broker y backend de resultados de Celery")]),
    ]),

    h3("3.2.2 VM2 — Worker de Entrenamiento GPU"),
    body(
      "VM2 es la instancia de entrenamiento GPU. Permanece en estado TERMINATED (apagada) " +
      "la mayor parte del tiempo, lo que implica que no genera costes de computo. Solo se " +
      "activa cuando un usuario lanza un nuevo trabajo de entrenamiento, ejecuta el " +
      "entrenamiento completo y se apaga de forma autónoma al finalizar, garantizando " +
      "que no existen costes residuales por olvido o fallo del proceso."
    ),
    makeTable([
      tRow([tCell("Parametro", { header: true }), tCell("Valor", { header: true })]),
      tRow([tCell("Tipo de maquina GCP"), tCell("n1-standard-8 (8 vCPU, 30 GB RAM)")]),
      tRow([tCell("GPU"), tCell("NVIDIA A100 40 GB (o equivalente segun disponibilidad regional)")]),
      tRow([tCell("Almacenamiento"), tCell("Disco de arranque 100 GB (NVMe SSD)")]),
      tRow([tCell("Coste estimado"), tCell("~$3.00-4.00 USD/hora, solo durante entrenamiento activo")]),
      tRow([tCell("Sistema operativo"), tCell("Deep Learning VM (CUDA 12 preinstalado)")]),
      tRow([tCell("Rol"), tCell("Entrenamiento YOLO, reporte de metricas por epoch, auto-apagado garantizado")]),
    ]),

    h2("3.3 Google Cloud Storage como bus de datos"),
    body(
      "Google Cloud Storage (GCS) actúa como superficie de acoplamiento entre todos los " +
      "componentes del sistema: VM1, VM2 y MENTAT. Ningún componente se comunica con otro " +
      "directamente para la transferencia de datos voluminosos; toda transferencia de " +
      "datasets y artefactos de modelos utiliza GCS como intermediario."
    ),
    body("La estructura canónica del bucket es la siguiente:"),
    ...codeBlock([
      "gs://{bucket}/",
      "├── temp-uploads/               # ZIPs temporales de uploads manuales",
      "│   └── {upload_uuid}/",
      "│       └── upload.zip          # Eliminado tras extraccion. Lifecycle: borrar a los 7 dias",
      "│",
      "├── datasets/",
      "│   ├── {project_name}/         # Datasets exportados desde MENTAT",
      "│   │   └── {timestamp}/",
      "│   │       ├── data.yaml       # Rutas GCS canonicas",
      "│   │       ├── metadata.json   # Clases, counts, fecha, source: 'mentat'",
      "│   │       ├── train/images/ + train/labels/",
      "│   │       └── val/images/ + val/labels/",
      "│   └── manual/                 # Datasets subidos manualmente",
      "│       └── {upload_uuid}/",
      "│           ├── data.yaml       # Regenerado con rutas GCS canonicas",
      "│           ├── metadata.json   # source: 'manual', original_filename, layout",
      "│           └── train/ + val/ (misma estructura)",
      "│",
      "├── jobs/pending/{job_id}/",
      "│   └── config.json             # Configuracion del job (modelo, dataset, hiperparametros)",
      "│",
      "├── models/{model_name}/",
      "│   ├── v1/  ├── best.pt        # Mejor checkpoint (max val mAP)",
      "│   │        ├── last.pt        # Ultimo checkpoint",
      "│   │        └── metrics.json   # mAP@50, mAP@50-95, precision, recall",
      "│   ├── v2/  ...",
      "│   └── production.json         # Puntero atomico a la version activa",
      "│",
      "└── logs/",
      "    └── job-{job_id}-error.txt  # Traza de error de VM2 (cuando aplica)",
    ]),

    h2("3.4 Principios de diseno arquitectonico"),
    h3("3.4.1 Acoplamiento debil mediante GCS"),
    body(
      "El sistema adopta un modelo de acoplamiento débil basado en GCS en lugar de llamadas " +
      "directas entre servicios para las transferencias de datos. VM2 lee su configuración " +
      "de GCS al arrancar, en lugar de recibirla de VM1 por red; MENTAT exporta datasets " +
      "a GCS en lugar de enviarlos al backend de la fábrica. Este patrón elimina la necesidad " +
      "de coordinar la disponibilidad simultánea de múltiples servicios y hace el sistema " +
      "resistente a fallos de conectividad transitorios."
    ),
    h3("3.4.2 Auto-aprovisionamiento con garantia de apagado"),
    body(
      "El auto-apagado de VM2 es una garantía de seguridad crítica para el control de costes. " +
      "Se implementa mediante una doble protección: el script de inicio " +
      "(startup.sh) incluye una trampa EXIT que invoca el apagado incluso ante " +
      "señales de sistema inesperadas; el script Python de entrenamiento envuelve " +
      "toda su lógica en un bloque try/except/finally que garantiza la ejecución " +
      "del comando de apagado independientemente del tipo de error producido. " +
      "Adicionalmente, la tarea Celery de orquestación en VM1 dispone de un timeout " +
      "de 4 horas que marca el job como fallido y emite una alerta si VM2 no se " +
      "auto-termina en el plazo esperado."
    ),
    h3("3.4.3 Atomicidad del puntero de produccion"),
    body(
      "La promoción de una versión de modelo a producción implica actualizar el fichero " +
      "production.json en GCS, que es leído por la API de inferencia. Esta operación " +
      "se implementa con precondiciones de generación de GCS (if_generation_match), " +
      "equivalentes a una operación de compare-and-swap: la escritura solo procede si " +
      "la generación actual del objeto coincide con la esperada. Si dos usuarios intentan " +
      "promover versiones distintas de forma simultánea, solo uno tiene éxito; el otro " +
      "recibe un error HTTP 412 y puede reintentar. Este mecanismo garantiza consistencia " +
      "sin necesidad de un sistema de bloqueo distribuido externo."
    ),
    h3("3.4.4 Upload directo frontend a GCS (Resumable Upload Sessions)"),
    body(
      "Los datasets manuales, que pueden alcanzar los 20 GB, se suben directamente desde " +
      "el navegador del usuario a GCS mediante sesiones de upload resumible, sin transitar " +
      "por el backend. El backend solo interviene para crear la sesión de upload y para " +
      "confirmar la finalización. Esto elimina el riesgo de timeouts HTTP en transferencias " +
      "largas, reduce la carga de red y memoria de VM1 y delega la gestión de reintentos y " +
      "reanudaciones al protocolo estándar de GCS Resumable Uploads."
    ),
    pageBreak(),
  ];
}

// ─── SECTION 4: Pipeline de datos ─────────────────────────────────────────────

function s4() {
  return [
    h1("4. Pipeline de Datos"),
    h2("4.1 Flujo de vida de un dataset"),
    body(
      "Un dataset atraviesa los siguientes estados durante su ciclo de vida en el sistema. " +
      "Cada transición de estado se persiste en la base de datos PostgreSQL y es visible " +
      "en tiempo real en la interfaz de usuario mediante polling."
    ),
    ...codeBlock([
      "",
      "  pending_upload",
      "       |",
      "       | (usuario completa la subida del ZIP a GCS)",
      "       v",
      "   extracting  <── Celery task: extract_dataset_zip",
      "       |         1. Comprobacion espacio disco",
      "       |         2. Descarga ZIP de GCS",
      "       |         3. Validacion integridad ZIP",
      "       |         4. Deteccion de layout (split / nested / flat)",
      "       |         5. Extraccion al disco local",
      "       |         6. Normalizacion de layout",
      "       v",
      "   validating",
      "       |         7. Parseo y validacion de data.yaml",
      "       |         8. Validacion de etiquetas (muestreo 5%)",
      "       |         9. Generacion de data.yaml canonico",
      "       |        10. Generacion de metadata.json",
      "       |        11. Upload a GCS (ThreadPoolExecutor, 16 workers)",
      "       v",
      "     ready  ──── Dataset disponible para entrenamiento",
      "       |",
      "       | (ante cualquier error de validacion o procesamiento)",
      "       v",
      "    failed  ──── Mensaje de error almacenado en BD",
      "",
    ]),

    h2("4.2 Formatos de dataset aceptados"),
    body(
      "El sistema acepta datasets en formato YOLO empaquetados en un archivo ZIP. " +
      "El motor de detección de layout identifica automáticamente tres estructuras " +
      "de directorios diferentes y las normaliza todas a la estructura canónica " +
      "YOLO split antes del entrenamiento."
    ),

    h3("4.2.1 Layout A: Split (estructura estandar YOLO)"),
    body("Estructura directamente compatible. No requiere transformación."),
    ...codeBlock([
      "dataset.zip",
      "├── data.yaml",
      "├── train/",
      "│   ├── images/    (imágenes de entrenamiento)",
      "│   └── labels/    (archivos .txt YOLO de entrenamiento)",
      "└── val/",
      "    ├── images/    (imágenes de validación)",
      "    └── labels/    (archivos .txt YOLO de validación)",
    ]),

    h3("4.2.2 Layout B: Nested (arbol paralelo)"),
    body("Estructura con árbol de imágenes y etiquetas paralelos. Se restructura en-lugar a layout A."),
    ...codeBlock([
      "dataset.zip",
      "├── data.yaml",
      "├── images/",
      "│   ├── train/     → se mueve a train/images/",
      "│   └── val/       → se mueve a val/images/",
      "└── labels/",
      "    ├── train/     → se mueve a train/labels/",
      "    └── val/       → se mueve a val/labels/",
    ]),

    h3("4.2.3 Layout C: Flat (pool unico)"),
    body(
      "Dataset sin división train/val. Se aplica un auto-split 80/20 con semilla " +
      "determinista (random.Random(42)) para reproducibilidad. Las parejas imagen-etiqueta " +
      "se mantienen juntas durante el split."
    ),
    ...codeBlock([
      "dataset.zip",
      "├── data.yaml",
      "├── images/    (todas las imágenes, sin subdivisión)",
      "└── labels/    (todas las etiquetas, sin subdivisión)",
      "",
      "  → Auto-split 80/20 → train/ (80%) + val/ (20%)",
    ]),

    h2("4.3 Formato de etiquetas YOLO"),
    body(
      "El sistema valida que los archivos de etiquetas cumplan el formato YOLO estándar. " +
      "Cada línea de un archivo .txt representa una anotación de objeto:"
    ),
    ...codeBlock([
      "  <class_id> <x_center> <y_center> <width> <height>",
      "",
      "  Donde:",
      "  - class_id: entero en [0, nc-1]",
      "  - x_center, y_center, width, height: flotantes en [0.0, 1.0]",
      "    (normalizados por las dimensiones de la imagen)",
      "",
      "  Ejemplo:",
      "  0 0.512 0.438 0.234 0.187",
      "  1 0.723 0.651 0.112 0.089",
    ]),
    body(
      "La validación por muestreo inspecciona al menos el 5% de los archivos de etiquetas " +
      "de train/labels/ (mínimo 10 archivos). Verifica: exactamente 5 campos por línea, " +
      "class_id numérico y menor que nc, coordenadas flotantes en el rango [0.0, 1.0]. " +
      "Se detiene tras detectar 5 errores y reporta todos ellos en el mensaje de error."
    ),

    h2("4.4 Formato data.yaml canonico"),
    body(
      "Independientemente del data.yaml original, el sistema regenera un archivo " +
      "data.yaml canónico con rutas absolutas GCS. Este archivo es el que utiliza " +
      "VM2 para localizar los datos durante el entrenamiento."
    ),
    ...codeBlock([
      "# data.yaml canonico generado por la Fabrica de Modelos",
      "path: 'gs://{bucket}/datasets/manual/{upload_uuid}'",
      "train: 'train/images'",
      "val:   'val/images'",
      "nc: 3",
      "names:",
      "  - glove",
      "  - hand",
      "  - tool",
    ]),
    body(
      "Cuando VM2 descarga el dataset para entrenamiento, reescribe el path del " +
      "data.yaml con la ruta local /tmp/dataset, adaptándolo al sistema de ficheros " +
      "de la máquina de entrenamiento. La estructura de directorios (train/images/, etc.) " +
      "es idéntica en GCS y en local, lo que hace la transformación trivial y sin pérdida."
    ),
    pageBreak(),
  ];
}

// ─── SECTION 5: Pipeline de Entrenamiento ─────────────────────────────────────

function s5() {
  return [
    h1("5. Pipeline de Entrenamiento"),
    h2("5.1 Ciclo de vida de un job de entrenamiento"),
    body(
      "Un job de entrenamiento es la unidad de trabajo que encapsula la configuración, " +
      "ejecución y resultado de un ciclo de entrenamiento de un modelo YOLO. Su ciclo de " +
      "vida abarca desde la creación por parte del usuario hasta la disponibilidad del " +
      "modelo entrenado en el registro."
    ),
    ...codeBlock([
      "",
      "  [Usuario lanza job desde frontend]",
      "         |",
      "         v",
      "      pending  ── Job creado en BD",
      "         |",
      "         | Celery task: launch_training_job (pool: vm_lifecycle)",
      "         |",
      "         v",
      "   provisioning ── Configuracion escrita en GCS",
      "         |         Metadatos VM2 actualizados",
      "         |         VM2 arrancada via GCP API",
      "         |",
      "         v",
      "    training  ── VM2 en estado RUNNING",
      "         |        Metricas reportadas por epoch",
      "         |        (train_loss, val_loss, mAP50, mAP50-95)",
      "         |",
      "         ├─────────────────────────────────────┐",
      "         |                                     |",
      "         v                                     v",
      "    completed  ── best.pt + metrics.json   failed  ── error_message en BD",
      "                  en GCS                           ── traza en GCS logs/",
      "                  Modelo registrado en BD",
      "                  VM2 apagada",
      "",
    ]),

    h2("5.2 Tarea Celery de lifecycle: launch_training_job"),
    body(
      "La tarea launch_training_job se ejecuta en el pool vm_lifecycle de Celery " +
      "(concurrencia=4) y orquesta el ciclo de vida completo de VM2 de forma síncrona " +
      "mediante polling activo."
    ),
    h3("Paso 1: Escritura de configuracion en GCS"),
    body(
      "El primer paso es publicar la configuración del job en GCS antes de arrancar VM2, " +
      "de modo que el script de inicio de VM2 pueda leerla en el momento de arranque. " +
      "La configuración se escribe en JSON en jobs/pending/{job_id}/config.json:"
    ),
    ...codeBlock([
      "{",
      '  "job_id":           42,',
      '  "dataset_gcs_path": "datasets/manual/abc-123/",',
      '  "model_type":       "yolov8m",',
      '  "model_name":       "defect-detector-v1",',
      '  "config": {',
      '    "epochs":     100,',
      '    "batch_size": -1',
      '  },',
      '  "backend_api_url":  "http://10.128.0.2"',
      "}",
    ]),

    h3("Paso 2: Configuracion de metadatos de VM2"),
    body(
      "Se establece el atributo de metadatos de instancia alphaplus-job-id en VM2 " +
      "mediante la GCP Compute Engine API. El script de inicio de VM2 (startup.sh) " +
      "lee este atributo del servidor de metadatos de GCP (169.254.169.254) en el " +
      "momento del arranque para saber qué job debe procesar."
    ),

    h3("Paso 3 a 5: Arranque de VM2 y espera"),
    body(
      "Tras emitir el comando de arranque, la tarea espera un periodo de gracia de 45 " +
      "segundos para absorber la latencia de transición de GCP de TERMINATED a STAGING. " +
      "A continuación entra en un bucle de polling con intervalo de 30 segundos y " +
      "timeout de 10 minutos, esperando que VM2 alcance el estado RUNNING. El código " +
      "maneja correctamente el caso extremo en que VM2 pasa por RUNNING tan rápidamente " +
      "que Celery no lo observa, detectándolo por la transición a TERMINATED tras haber " +
      "visto previamente un estado no-TERMINATED."
    ),

    h3("Paso 6 a 8: Monitoreo y verificacion de resultado"),
    body(
      "Una vez VM2 está en RUNNING, el job se marca como 'training'. La tarea entra " +
      "entonces en un segundo bucle de polling con timeout de 4 horas, esperando la " +
      "auto-terminación de VM2. VM2 puede actualizar el estado del job directamente " +
      "vía PATCH /api/training/jobs/{id} durante el entrenamiento, en cuyo caso Celery " +
      "puede retornar anticipadamente. Al detectar la terminación de VM2, si el estado " +
      "del job aún es 'training', la tarea comprueba la existencia de best.pt en GCS " +
      "como indicador de éxito y actualiza el estado en consecuencia."
    ),

    h2("5.3 Worker de entrenamiento en VM2"),
    body(
      "El script train_worker.py se descarga de GCS durante el arranque de VM2 y " +
      "encapsula toda la lógica de entrenamiento. A continuación se describe en detalle " +
      "cada fase de su ejecución."
    ),

    h3("5.3.1 Lectura de configuracion y descarga de dataset"),
    body(
      "El worker lee el archivo config.json de GCS, extrae los parámetros del job y " +
      "descarga el dataset completo a /tmp/dataset/ en el SSD local de VM2. " +
      "La descarga usa la librería google-cloud-storage con acceso implícito a las " +
      "credenciales de la service account asociada a la instancia VM2. Tras la descarga, " +
      "el data.yaml se reescribe con la ruta local /tmp/dataset como valor del campo path."
    ),

    h3("5.3.2 Entrenamiento YOLO con Ultralytics"),
    body(
      "El entrenamiento se ejecuta mediante la librería Ultralytics YOLO, que proporciona " +
      "una API de alto nivel sobre PyTorch para el entrenamiento de modelos de detección " +
      "de objetos de la familia YOLO (YOLOv8, YOLO11). Los modelos base se descargan " +
      "automáticamente desde los repositorios de Ultralytics en el arranque."
    ),
    ...codeBlock([
      "from ultralytics import YOLO",
      "",
      "model = YOLO('yolov8m.pt')   # Descarga pesos base preentrenados en COCO",
      "model.add_callback('on_fit_epoch_end', make_on_fit_epoch_end(JOB_ID))",
      "",
      "results = model.train(",
      "    data='/tmp/dataset/data.yaml',",
      "    epochs=100,",
      "    batch=-1,          # Auto-batch: usa el maximo batch que cabe en GPU",
      "    project='/tmp/runs',",
      "    name='train',",
      "    exist_ok=True,",
      ")",
    ]),

    h3("5.3.3 Reporte de metricas en tiempo real"),
    body(
      "El callback on_fit_epoch_end se invoca al final de cada epoch durante el " +
      "entrenamiento. En cada invocación, el worker reporta las métricas del epoch " +
      "al endpoint POST /api/training/jobs/{id}/metrics de VM1, que las persiste en " +
      "la tabla training_metrics de PostgreSQL. La interfaz de usuario realiza polling " +
      "sobre este endpoint para visualizar las curvas de pérdida y mAP en tiempo real."
    ),
    ...codeBlock([
      "Metricas reportadas por epoch:",
      "  - train/box_loss     → perdida de localizacion de bounding box (entrenamiento)",
      "  - val/box_loss       → perdida de localizacion de bounding box (validacion)",
      "  - metrics/mAP50(B)   → mAP a IoU=0.50",
      "  - metrics/mAP50-95(B)→ mAP promedio en IoU=[0.50:0.95:0.05]",
    ]),

    h3("5.3.4 Publicacion de artefactos y registro de version"),
    body(
      "Al finalizar el entrenamiento, el worker sube los artefactos a GCS, determina " +
      "el numero de version incrementando el maximo existente para ese modelo, y registra " +
      "la nueva version en el backend:"
    ),
    ...codeBlock([
      "gs://{bucket}/models/{model_name}/v{version}/",
      "  best.pt       <- mejor checkpoint (maximo val mAP a lo largo de todos los epochs)",
      "  last.pt       <- checkpoint del ultimo epoch",
      "  metrics.json  <- metricas finales: mAP50, mAP50-95, precision, recall, epochs",
    ]),

    h3("5.3.5 Auto-apagado garantizado"),
    body(
      "El comando de auto-apagado se encuentra en el bloque finally del script Python, " +
      "garantizando su ejecución independientemente del resultado del entrenamiento. " +
      "Adicionalmente, el startup.sh incluye trap EXIT para cubrir el caso de señales " +
      "de sistema inesperadas. El comando es:"
    ),
    ...codeBlock([
      "os.system(f'gcloud compute instances stop $(hostname) --zone={ZONE}')",
    ]),

    h2("5.4 Modelos YOLO soportados"),
    body(
      "El sistema soporta toda la familia de modelos YOLO de Ultralytics, " +
      "incluyendo las generaciones YOLOv8 y YOLO11. La elección del modelo " +
      "base afecta directamente al equilibrio entre velocidad de inferencia " +
      "y precisión (mAP)."
    ),
    makeTable([
      tRow([tCell("Modelo", { header: true }), tCell("Parametros (M)", { header: true }), tCell("mAP COCO val", { header: true }), tCell("Velocidad (ms, A100)", { header: true }), tCell("Uso recomendado", { header: true })]),
      tRow([tCell("yolov8n / yolo11n"), tCell("3.2 / 2.6"),    tCell("37.3 / 39.5"), tCell("~1.1"),  tCell("Edge, tiempo real estricto, recursos limitados")]),
      tRow([tCell("yolov8s / yolo11s"), tCell("11.2 / 9.4"),   tCell("44.9 / 47.0"), tCell("~1.5"),  tCell("Balance velocidad/precision para lineas rapidas")]),
      tRow([tCell("yolov8m / yolo11m"), tCell("25.9 / 20.1"),  tCell("50.2 / 51.5"), tCell("~2.1"),  tCell("Uso general en inspeccion industrial (recomendado)")]),
      tRow([tCell("yolov8l / yolo11l"), tCell("43.7 / 25.3"),  tCell("52.9 / 53.4"), tCell("~3.2"),  tCell("Alta precision, latencia moderada tolerable")]),
      tRow([tCell("yolov8x / yolo11x"), tCell("68.2 / 56.9"),  tCell("53.9 / 54.7"), tCell("~4.8"),  tCell("Maxima precision, inferencia batch, sin restriccion de latencia")]),
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 6: Modulos Funcionales ───────────────────────────────────────────

function s6() {
  return [
    h1("6. Modulos Funcionales de la Plataforma"),
    h2("6.1 Dataset Browser"),
    body(
      "El Dataset Browser es el módulo de gestión de datasets de la plataforma. " +
      "Proporciona una vista centralizada de todos los datasets disponibles para " +
      "entrenamiento, organizados por origen."
    ),
    h3("6.1.1 Pestaña MENTAT"),
    body(
      "Lista los datasets exportados desde la plataforma de etiquetado MENTAT. " +
      "El backend descubre estos datasets automáticamente listando los prefijos " +
      "bajo gs://bucket/datasets/{project_name}/ en GCS. Para cada dataset se " +
      "muestra: nombre del proyecto, timestamp de exportación, número de clases, " +
      "nombres de clases, número de imágenes y distribución train/val."
    ),
    h3("6.1.2 Pestaña Manual Upload"),
    body(
      "Lista los datasets subidos directamente por el usuario mediante el flujo " +
      "de upload manual. Cada entrada muestra: nombre del archivo ZIP original, " +
      "fecha de subida, estado actual, número de clases, número de imágenes y " +
      "layout original detectado."
    ),
    h3("6.1.3 Flujo de upload manual"),
    body(
      "El flujo de upload manual está diseñado para soportar datasets de hasta 20 GB " +
      "sin riesgo de timeout. El protocolo es el siguiente:"
    ),
    ...codeBlock([
      "1. Usuario selecciona archivo ZIP en la UI",
      "   POST /api/datasets/upload/init",
      "   → Backend crea registro en BD (status='pending_upload')",
      "   → Backend crea sesion resumable GCS (create_resumable_upload_session)",
      "   ← Backend retorna { dataset_id, gcs_resumable_url }",
      "",
      "2. Frontend sube ZIP directamente a GCS via XHR (no fetch)",
      "   PUT {gcs_resumable_url} con el archivo ZIP",
      "   → XHR.upload.onprogress → barra de progreso en UI",
      "   (VM1 no interviene en la transferencia del archivo)",
      "",
      "3. POST /api/datasets/upload/complete",
      "   → Backend encola tarea Celery extract_dataset_zip",
      "   ← Backend retorna { status: 'extracting' }",
      "",
      "4. Frontend poll GET /api/datasets/{id}/status cada 5s",
      "   ← { status, progress_message }",
      "   hasta status = 'ready' o 'failed'",
    ]),

    h2("6.2 Training Manager"),
    body(
      "El Training Manager permite al usuario configurar y lanzar trabajos de " +
      "entrenamiento, y monitorizar su progreso en tiempo real."
    ),
    h3("6.2.1 Configuracion del job"),
    makeTable([
      tRow([tCell("Parametro", { header: true }), tCell("Descripcion", { header: true }), tCell("Valores posibles", { header: true })]),
      tRow([tCell("Dataset"), tCell("Dataset de entrenamiento (status='ready')"), tCell("Cualquier dataset ready de origen mentat o manual")]),
      tRow([tCell("Modelo base"), tCell("Arquitectura YOLO de partida"), tCell("yolov8n/s/m/l/x, yolo11n/s/m/l/x")]),
      tRow([tCell("Nombre del modelo"), tCell("Nombre del artefacto que se creara en GCS"), tCell("Cadena de texto libre")]),
      tRow([tCell("Epochs"), tCell("Numero de epochs de entrenamiento"), tCell("Entero positivo (por defecto: 100)")]),
      tRow([tCell("Batch size"), tCell("Tamano de batch GPU"), tCell("Entero positivo o -1 para auto-batch")]),
    ]),

    h3("6.2.2 Monitorizacion en tiempo real"),
    body(
      "Una vez lanzado el job, el Training Manager muestra el estado actual del job, " +
      "el estado de VM2 (provisioning / running / terminated), y las curvas de " +
      "métricas actualizadas por epoch: train_loss, val_loss, mAP@50 y mAP@50-95. " +
      "La actualización se realiza mediante polling sobre GET /api/training/jobs/{id}/metrics " +
      "cada 10 segundos mientras el job está en estado 'training'."
    ),

    h2("6.3 Model Registry"),
    body(
      "El Model Registry es el catálogo de todas las versiones de modelos generados " +
      "por la plataforma. Proporciona comparativa de rendimiento entre versiones y " +
      "permite gestionar la versión en producción."
    ),
    h3("6.3.1 Catalogo de versiones"),
    body("Para cada modelo, el registro muestra una tabla comparativa de todas sus versiones:"),
    makeTable([
      tRow([tCell("Campo", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("Version"),     tCell("Numero de version (v1, v2, v3, ...)")]),
      tRow([tCell("mAP@50"),      tCell("Mean Average Precision a IoU=0.50 del mejor checkpoint")]),
      tRow([tCell("mAP@50-95"),   tCell("mAP promedio en el rango IoU=[0.50:0.95:0.05]")]),
      tRow([tCell("Precision"),   tCell("Precision del modelo (TP/(TP+FP))")]),
      tRow([tCell("Recall"),      tCell("Recall del modelo (TP/(TP+FN))")]),
      tRow([tCell("Velocidad"),   tCell("Tiempo de inferencia en ms por imagen (en GPU A100)")]),
      tRow([tCell("En produccion"),tCell("Indicador booleano. Solo una version puede estar activa simultaneamente")]),
      tRow([tCell("Fecha"),       tCell("Fecha de finalizacion del entrenamiento")]),
    ]),
    h3("6.3.2 Promocion a produccion"),
    body(
      "El botón 'Promover a producción' actualiza el archivo production.json en GCS " +
      "con la version seleccionada mediante una operación atómica (if_generation_match). " +
      "La API de inferencia detecta el cambio en el siguiente ciclo de carga y actualiza " +
      "el modelo en memoria sin necesidad de reiniciar el servicio."
    ),

    h2("6.4 Inference API"),
    body(
      "La API de Inferencia expone el modelo en producción como un endpoint REST " +
      "compatible con cualquier cliente HTTP. Está diseñada para integrarse en sistemas " +
      "de control de calidad industrial en tiempo real."
    ),
    makeTable([
      tRow([tCell("Endpoint", { header: true }), tCell("Metodo", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("/api/inference/status"),  tCell("GET"),  tCell("Estado del modelo cargado: nombre, version, mAP, tiempo de carga")]),
      tRow([tCell("/api/inference/predict"), tCell("POST"), tCell("Inferencia. Body: imagen en base64 o multipart/form-data. Respuesta: bboxes, clases, scores")]),
    ]),
    body(
      "El modelo se carga de forma perezosa (lazy load) en la primera inferencia: " +
      "se descarga best.pt de GCS al directorio local de VM1 y se carga en memoria " +
      "con Ultralytics YOLO. La instancia del modelo se cachea indexada por (model_name, version), " +
      "de modo que peticiones sucesivas no incurren en latencia de carga. " +
      "Cuando production.json cambia (nueva promoción), el router de inferencia detecta " +
      "el cambio y reemplaza la instancia cacheada en la siguiente petición."
    ),
    pageBreak(),
  ];
}

// ─── SECTION 7: Modelo de Datos ───────────────────────────────────────────────

function s7() {
  return [
    h1("7. Modelo de Datos Relacional"),
    body(
      "El sistema utiliza PostgreSQL 16 como base de datos relacional para la " +
      "persistencia de metadatos de datasets, jobs de entrenamiento, métricas " +
      "por epoch y versiones de modelos. Todas las tablas están gestionadas " +
      "mediante SQLAlchemy ORM con Alembic para migraciones. A continuación se " +
      "detalla el esquema de cada tabla."
    ),

    h2("7.1 Tabla: datasets"),
    makeTable([
      tRow([tCell("Campo", { header: true }), tCell("Tipo SQL", { header: true }), tCell("Restricciones", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("id"),                tCell("INTEGER"),   tCell("PK, AUTOINCREMENT"),  tCell("Identificador unico del dataset")]),
      tRow([tCell("gcs_path"),          tCell("TEXT"),      tCell("NULLABLE"),            tCell("Ruta GCS canonica (datasets/manual/{uuid}/ o datasets/{project}/{ts}/)")]),
      tRow([tCell("class_count"),       tCell("INTEGER"),   tCell("NULLABLE"),            tCell("Numero de clases segun data.yaml")]),
      tRow([tCell("image_count"),       tCell("INTEGER"),   tCell("NULLABLE"),            tCell("Total de imagenes: train_count + val_count")]),
      tRow([tCell("upload_date"),       tCell("TIMESTAMP"), tCell("DEFAULT NOW"),         tCell("Fecha y hora de creacion del registro")]),
      tRow([tCell("project_name"),      tCell("TEXT"),      tCell("NULLABLE"),            tCell("Nombre del proyecto MENTAT o nombre del archivo ZIP original")]),
      tRow([tCell("source"),            tCell("TEXT"),      tCell("NOT NULL"),            tCell("'mentat' o 'manual'")]),
      tRow([tCell("status"),            tCell("TEXT"),      tCell("NOT NULL"),            tCell("pending_upload / extracting / validating / ready / failed")]),
      tRow([tCell("class_names"),       tCell("JSON"),      tCell("NULLABLE"),            tCell("Lista JSON de nombres de clases ['glove', 'hand', ...]")]),
      tRow([tCell("celery_task_id"),    tCell("TEXT"),      tCell("NULLABLE"),            tCell("ID de la tarea Celery activa de extraccion")]),
      tRow([tCell("original_filename"), tCell("TEXT"),      tCell("NULLABLE"),            tCell("Nombre del archivo ZIP original subido por el usuario")]),
      tRow([tCell("file_size_bytes"),   tCell("BIGINT"),    tCell("NULLABLE"),            tCell("Tamano del ZIP en bytes (para comprobacion de espacio en disco)")]),
      tRow([tCell("error_message"),     tCell("TEXT"),      tCell("NULLABLE"),            tCell("Mensaje de error detallado si status='failed'")]),
      tRow([tCell("progress_message"),  tCell("TEXT"),      tCell("NULLABLE"),            tCell("Mensaje de progreso en tiempo real (visible en UI durante procesamiento)")]),
    ]),

    h2("7.2 Tabla: jobs"),
    makeTable([
      tRow([tCell("Campo", { header: true }), tCell("Tipo SQL", { header: true }), tCell("Restricciones", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("id"),             tCell("INTEGER"),   tCell("PK, AUTOINCREMENT"),   tCell("Identificador unico del job")]),
      tRow([tCell("dataset_id"),     tCell("INTEGER"),   tCell("FK → datasets.id"),    tCell("Dataset de entrada usado para el entrenamiento")]),
      tRow([tCell("model_type"),     tCell("TEXT"),      tCell("NOT NULL"),             tCell("Tipo de modelo base (p. ej. 'yolov8m', 'yolo11l')")]),
      tRow([tCell("model_name"),     tCell("TEXT"),      tCell("NOT NULL"),             tCell("Nombre del artefacto de modelo que se creara en GCS")]),
      tRow([tCell("config"),         tCell("JSON"),      tCell("NULLABLE"),             tCell("Hiperparametros: {epochs: 100, batch_size: -1}")]),
      tRow([tCell("status"),         tCell("TEXT"),      tCell("NOT NULL"),             tCell("pending / provisioning / training / completed / failed")]),
      tRow([tCell("start_time"),     tCell("TIMESTAMP"), tCell("NULLABLE"),             tCell("Marca de tiempo de inicio del entrenamiento en VM2")]),
      tRow([tCell("end_time"),       tCell("TIMESTAMP"), tCell("NULLABLE"),             tCell("Marca de tiempo de finalizacion del entrenamiento")]),
      tRow([tCell("celery_task_id"), tCell("TEXT"),      tCell("NULLABLE"),             tCell("ID de la tarea Celery de lifecycle activa")]),
      tRow([tCell("error_message"),  tCell("TEXT"),      tCell("NULLABLE"),             tCell("Descripcion del error si status='failed'")]),
    ]),

    h2("7.3 Tabla: training_metrics"),
    makeTable([
      tRow([tCell("Campo", { header: true }), tCell("Tipo SQL", { header: true }), tCell("Restricciones", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("id"),         tCell("INTEGER"),   tCell("PK, AUTOINCREMENT"),  tCell("Identificador unico de la metrica")]),
      tRow([tCell("job_id"),     tCell("INTEGER"),   tCell("FK → jobs.id"),       tCell("Job al que pertenece esta metrica")]),
      tRow([tCell("epoch"),      tCell("INTEGER"),   tCell("NOT NULL"),            tCell("Numero de epoch (1 a epochs)")]),
      tRow([tCell("train_loss"), tCell("FLOAT"),     tCell("NULLABLE"),            tCell("Perdida de localizacion (box loss) en el conjunto de entrenamiento")]),
      tRow([tCell("val_loss"),   tCell("FLOAT"),     tCell("NULLABLE"),            tCell("Perdida de localizacion (box loss) en el conjunto de validacion")]),
      tRow([tCell("map50"),      tCell("FLOAT"),     tCell("NULLABLE"),            tCell("Mean Average Precision a IoU=0.50")]),
      tRow([tCell("map50_95"),   tCell("FLOAT"),     tCell("NULLABLE"),            tCell("mAP promedio en IoU=[0.50:0.95:0.05]")]),
      tRow([tCell("timestamp"),  tCell("TIMESTAMP"), tCell("DEFAULT NOW"),         tCell("Momento de registro de la metrica")]),
    ]),

    h2("7.4 Tabla: model_versions"),
    makeTable([
      tRow([tCell("Campo", { header: true }), tCell("Tipo SQL", { header: true }), tCell("Restricciones", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("id"),           tCell("INTEGER"),   tCell("PK, AUTOINCREMENT"), tCell("Identificador unico de la version")]),
      tRow([tCell("job_id"),       tCell("INTEGER"),   tCell("FK → jobs.id"),      tCell("Job de entrenamiento que genero esta version")]),
      tRow([tCell("model_name"),   tCell("TEXT"),      tCell("NOT NULL"),           tCell("Nombre del modelo (clave de agrupacion en Model Registry)")]),
      tRow([tCell("version"),      tCell("INTEGER"),   tCell("NOT NULL"),           tCell("Numero de version. Se incrementa automaticamente por nombre de modelo")]),
      tRow([tCell("gcs_path"),     tCell("TEXT"),      tCell("NOT NULL"),           tCell("Ruta GCS de los artefactos (models/{name}/v{n}/)")]),
      tRow([tCell("map50"),        tCell("FLOAT"),     tCell("NULLABLE"),           tCell("mAP@50 del mejor checkpoint")]),
      tRow([tCell("precision"),    tCell("FLOAT"),     tCell("NULLABLE"),           tCell("Precision global del modelo")]),
      tRow([tCell("recall"),       tCell("FLOAT"),     tCell("NULLABLE"),           tCell("Recall global del modelo")]),
      tRow([tCell("speed_ms"),     tCell("FLOAT"),     tCell("NULLABLE"),           tCell("Velocidad de inferencia en ms por imagen")]),
      tRow([tCell("is_production"),tCell("BOOLEAN"),   tCell("DEFAULT false"),      tCell("Indica si esta version esta actualmente en produccion")]),
      tRow([tCell("created_at"),   tCell("TIMESTAMP"), tCell("DEFAULT NOW"),        tCell("Fecha y hora de registro de la version")]),
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 8: API REST ──────────────────────────────────────────────────────

function s8() {
  return [
    h1("8. API REST — Referencia Completa"),
    body(
      "La API REST es implementada con FastAPI y expuesta por Nginx en el puerto 80 " +
      "bajo el prefijo /api/. Todos los endpoints devuelven JSON. El motor de " +
      "documentación automática OpenAPI de FastAPI genera documentación interactiva " +
      "disponible en /api/docs (Swagger UI) y /api/redoc."
    ),

    h2("8.1 Datasets (/api/datasets)"),
    makeTable([
      tRow([tCell("Metodo", { header: true }), tCell("Ruta", { header: true }), tCell("Request Body / Params", { header: true }), tCell("Response", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("GET"),    tCell("/mentat"),           tCell("-"),                                          tCell("[DatasetSchema]"),   tCell("Lista datasets disponibles en GCS exportados desde MENTAT. Descubre prefijos en gs://bucket/datasets/{project}/")]),
      tRow([tCell("GET"),    tCell("/manual"),           tCell("-"),                                          tCell("[DatasetSchema]"),   tCell("Lista datasets manuales registrados en BD con status != 'deleted'")]),
      tRow([tCell("POST"),   tCell("/upload/init"),      tCell("{filename, size_bytes, project_name?}"),      tCell("{dataset_id, gcs_resumable_url}"), tCell("Crea registro en BD y sesion GCS resumable para upload directo del cliente")]),
      tRow([tCell("POST"),   tCell("/upload/complete"),  tCell("{dataset_id, upload_id}"),                   tCell("{status: 'extracting'}"),          tCell("Confirma la subida. Encola tarea Celery extract_dataset_zip")]),
      tRow([tCell("GET"),    tCell("/{id}/status"),      tCell("-"),                                          tCell("{id, status, progress_message, ...}"), tCell("Devuelve estado actual y mensaje de progreso del dataset")]),
      tRow([tCell("DELETE"), tCell("/{id}"),             tCell("-"),                                          tCell("{ok: true}"),        tCell("Elimina registro en BD y objetos en GCS (datasets/manual/{uuid}/)")]),
    ]),

    h2("8.2 Training (/api/training)"),
    makeTable([
      tRow([tCell("Metodo", { header: true }), tCell("Ruta", { header: true }), tCell("Request Body", { header: true }), tCell("Response", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("POST"),  tCell("/jobs"),              tCell("{dataset_id, model_type, model_name, config}"), tCell("JobSchema"),  tCell("Crea job en BD (status='pending') y encola tarea Celery launch_training_job")]),
      tRow([tCell("GET"),   tCell("/jobs"),              tCell("-"),                                             tCell("[JobSchema]"), tCell("Lista todos los jobs ordenados por fecha de creacion descendente")]),
      tRow([tCell("GET"),   tCell("/jobs/{id}"),         tCell("-"),                                             tCell("JobSchema"),  tCell("Detalle completo de un job: configuracion, estado, tiempos, error")]),
      tRow([tCell("GET"),   tCell("/jobs/{id}/metrics"), tCell("-"),                                             tCell("[MetricSchema]"), tCell("Serie temporal de metricas por epoch para visualizacion de curvas")]),
      tRow([tCell("POST"),  tCell("/jobs/{id}/metrics"), tCell("{epoch, train_loss, val_loss, map50, map50_95}"),tCell("ok"),         tCell("Callback de VM2: registra metricas de un epoch en BD (training_metrics)")]),
      tRow([tCell("PATCH"), tCell("/jobs/{id}"),         tCell("{status, error_message?}"),                     tCell("ok"),         tCell("Callback de VM2: actualiza estado final del job (completed/failed)")]),
    ]),

    h2("8.3 Models (/api/models)"),
    makeTable([
      tRow([tCell("Metodo", { header: true }), tCell("Ruta", { header: true }), tCell("Request Body", { header: true }), tCell("Response", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("GET"),  tCell("/"),                  tCell("-"),                                                             tCell("[ModelSchema]"),  tCell("Lista todos los modelos con sus versiones y metricas")]),
      tRow([tCell("GET"),  tCell("/{model_name}"),      tCell("-"),                                                             tCell("[VersionSchema]"),tCell("Todas las versiones de un modelo con metricas comparadas")]),
      tRow([tCell("POST"), tCell("/"),                  tCell("{job_id, model_name, version, gcs_path, map50, precision, recall}"),tCell("VersionSchema"),tCell("Registra una nueva version de modelo (callback de VM2 al finalizar)")]),
      tRow([tCell("POST"), tCell("/{id}/promote"),      tCell("-"),                                                             tCell("{ok, version}"),  tCell("Promueve version a produccion. Escritura atomica en production.json con if_generation_match")]),
    ]),

    h2("8.4 Inference (/api/inference)"),
    makeTable([
      tRow([tCell("Metodo", { header: true }), tCell("Ruta", { header: true }), tCell("Request Body", { header: true }), tCell("Response", { header: true }), tCell("Descripcion", { header: true })]),
      tRow([tCell("GET"),  tCell("/status"),    tCell("-"),                                   tCell("{model_name, version, map50, loaded}"), tCell("Estado del modelo en produccion cargado en memoria")]),
      tRow([tCell("POST"), tCell("/predict"),   tCell("image: base64 string o multipart"),   tCell("[{bbox, class, score}]"),               tCell("Inferencia. Retorna lista de detecciones con coordenadas, clase y confianza")]),
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 9: Stack Tecnologico ─────────────────────────────────────────────

function s9() {
  return [
    h1("9. Stack Tecnologico"),
    body(
      "El sistema está construido sobre un stack completamente de código abierto, con la " +
      "excepción de los servicios gestionados de Google Cloud Platform. Esta elección " +
      "garantiza la ausencia de dependencias de licencias propietarias en el núcleo del " +
      "software, facilita la portabilidad entre proveedores de nube y reduce los costes " +
      "de licenciamiento."
    ),

    makeTable([
      tRow([tCell("Capa", { header: true }), tCell("Tecnologia", { header: true }), tCell("Version", { header: true }), tCell("Justificacion tecnica", { header: true })]),
      tRow([tCell("Framework API"),          tCell("FastAPI + Uvicorn"),           tCell("0.110 / 0.28"),  tCell("Framework ASGI moderno con validacion automatica via Pydantic, generacion OpenAPI y alto rendimiento asíncrono. Ideal para APIs con operaciones I/O intensivas (GCS, PostgreSQL)")]),
      tRow([tCell("Frontend"),               tCell("React 18 + Vite"),             tCell("18.x / 5.x"),   tCell("React 18 con Concurrent Features para renderizado fluido. Vite como bundler por velocidad de HMR en desarrollo y builds optimizados en produccion")]),
      tRow([tCell("ORM"),                    tCell("SQLAlchemy"),                  tCell("2.x"),          tCell("ORM maduro con soporte para migraciones via Alembic, consultas tipadas y gestion de sesiones de BD")]),
      tRow([tCell("Base de datos"),          tCell("PostgreSQL 16"),               tCell("16-alpine"),    tCell("RDBMS de alto rendimiento con soporte JSON nativo, transacciones ACID, y escalabilidad demostrada para cargas de trabajo mixtas OLTP/analíticas")]),
      tRow([tCell("Cola de tareas"),         tCell("Celery 5"),                    tCell("5.x"),          tCell("Sistema de colas de tareas asincronas distribuido. Dos pools diferenciados por tipo de carga: extraccion (CPU/IO, concurrencia=1) y lifecycle (IO, concurrencia=4)")]),
      tRow([tCell("Broker de mensajes"),     tCell("Redis 7"),                     tCell("7-alpine"),     tCell("Broker de Celery de baja latencia y backend de resultados. Elegido sobre RabbitMQ por menor complejidad operativa en este escenario de un solo broker")]),
      tRow([tCell("Motor de entrenamiento"), tCell("Ultralytics YOLO"),            tCell("8.x"),          tCell("Librería de referencia para entrenamiento de modelos YOLO. Soporta YOLOv8 y YOLO11, auto-batch, callbacks por epoch y exportacion a multiples formatos")]),
      tRow([tCell("Cloud Storage"),          tCell("Google Cloud Storage"),        tCell("-"),            tCell("Almacenamiento de objetos gestionado con consistencia fuerte de lectura tras escritura, soporte para Resumable Uploads y precondiciones de generacion para operaciones atomicas")]),
      tRow([tCell("Upload de datasets"),     tCell("GCS Resumable Upload Sessions"),tCell("-"),           tCell("Protocolo de upload resumible que permite reanudar transferencias interrumpidas, soporta archivos de hasta 5 TB y elimina la necesidad de proxy en el backend para archivos grandes")]),
      tRow([tCell("VM lifecycle"),           tCell("GCP Compute Engine API"),      tCell("-"),            tCell("API de gestion de instancias virtuales para arranque/parada/consulta de estado de VM2 desde el worker Celery de VM1")]),
      tRow([tCell("Contenerizacion"),        tCell("Docker + Docker Compose"),     tCell("24.x / 2.x"),  tCell("Contenedores para aislamiento de dependencias y reproducibilidad de entornos. Compose para orquestacion local y de produccion en VM1")]),
      tRow([tCell("Proxy HTTP"),             tCell("Nginx Alpine"),                tCell("1.25-alpine"),  tCell("Reverse proxy de alto rendimiento para enrutamiento /api/ → backend y / → frontend. TLS termination y compresion gzip de assets estaticos")]),
      tRow([tCell("Lenguaje backend"),       tCell("Python 3.11"),                tCell("3.11"),         tCell("Python 3.11 con mejoras de rendimiento en CPython (+25% vs 3.10). Ecosistema ML sin competencia para integracion con Ultralytics, google-cloud y Celery")]),
    ]),

    h2("9.1 Dependencias de Python (backend y worker VM2)"),
    ...codeBlock([
      "# Backend (VM1)",
      "fastapi>=0.110",
      "uvicorn[standard]>=0.28",
      "sqlalchemy>=2.0",
      "psycopg2-binary",
      "alembic",
      "celery>=5.3",
      "redis>=5.0",
      "pyyaml>=6.0",
      "google-cloud-storage>=2.15",
      "google-api-python-client>=2.120",
      "pydantic>=2.6",
      "python-multipart",
      "",
      "# Worker de entrenamiento (VM2 — instalado en startup)",
      "ultralytics>=8.1",
      "torch>=2.2            # Con soporte CUDA 12",
      "google-cloud-storage>=2.15",
      "requests>=2.31",
      "pyyaml>=6.0",
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 10: Seguridad y Buenas Practicas ─────────────────────────────────

function s10() {
  return [
    h1("10. Seguridad, Resiliencia y Buenas Practicas"),

    h2("10.1 Control de costes de GPU"),
    body(
      "El control de costes de la GPU es una prioridad de primer orden dada la " +
      "tarifa de $3-4 USD/hora de las instancias con GPU A100. El sistema implementa " +
      "tres capas de protección:"
    ),
    bullet("Capa 1 — Auto-apagado en VM2: el bloque finally de train_worker.py ejecuta gcloud compute instances stop $(hostname) incondicionalmente, independientemente del resultado del entrenamiento."),
    bullet("Capa 2 — Trampa EXIT en startup.sh: garantiza el apagado ante senales de sistema inesperadas (SIGTERM, SIGKILL) o errores de Python no capturados por el except."),
    bullet("Capa 3 — Timeout de 4 horas en Celery: si VM2 no se auto-termina en 4 horas, la tarea Celery marca el job como fallido y puede emitir una alerta. El operador puede entonces apagar VM2 manualmente."),

    h2("10.2 Validacion defensiva de datasets"),
    body(
      "El pipeline de extracción y validación de datasets implementa validación " +
      "defensiva en cada paso para garantizar que solo datasets bien formados " +
      "alcancen la fase de entrenamiento, evitando fallos costosos durante el " +
      "entrenamiento en GPU."
    ),
    bullet("Comprobacion de espacio en disco antes de la extraccion (factor 5x respecto al tamano del ZIP). Fallo rapido ante espacio insuficiente."),
    bullet("Validacion de integridad del ZIP mediante zf.testzip() antes de la extraccion completa."),
    bullet("Deteccion de layout en el namelist del ZIP (sin extraer). Los ZIPs de estructura desconocida fallan con mensaje descriptivo."),
    bullet("Validacion semantica de data.yaml: presencia de nc y names, consistencia entre ambos campos."),
    bullet("Validacion de etiquetas por muestreo (5%, minimo 10 archivos): formato YOLO valido, class_id < nc, coordenadas en [0.0, 1.0]."),

    h2("10.3 Gestion de errores y trazabilidad"),
    body(
      "El sistema mantiene trazabilidad completa de errores en todos los niveles:"
    ),
    bullet("Mensajes de error de usuario almacenados en datasets.error_message y jobs.error_message en BD, visibles en la UI."),
    bullet("Trazas completas de excepciones de VM2 (traceback) subidas a GCS en logs/job-{job_id}-error.txt antes del apagado."),
    bullet("Logs estructurados con nivel, timestamp y contexto en todos los servicios mediante el modulo logging de Python."),
    bullet("Estado de progreso en tiempo real en datasets.progress_message durante la extraccion, visible en la UI."),

    h2("10.4 Lifecycle rules de GCS"),
    body(
      "El bucket de GCS está configurado con las siguientes reglas de ciclo de vida " +
      "para evitar la acumulación de datos obsoletos:"
    ),
    bullet("temp-uploads/: eliminacion automatica a los 7 dias. Protege contra uploads manuales abandonados sin confirmar."),
    bullet("datasets/: movimiento a Nearline storage a los 90 dias. Reduce el coste de almacenamiento de datasets antiguos sin eliminarlos."),
    bullet("logs/: eliminacion automatica a los 30 dias. Los logs de error solo son necesarios para diagnostico inmediato."),

    h2("10.5 Concurrencia y seguridad de datos"),
    body("El diseño del sistema previene condiciones de carrera en los puntos más críticos:"),
    bullet("Cola Celery de extraccion con concurrencia=1: evita que dos tareas de extraccion compitan por el espacio en disco de /data/extraction/ en VM1."),
    bullet("Puntero production.json con if_generation_match: operacion de compare-and-swap atomica en GCS. Impide que dos promociones simultaneas corrompan el estado de produccion."),
    bullet("Upload directo frontend-GCS: los uploads manuales no pasan por el backend, eliminando el riesgo de condiciones de carrera en la recepcion de archivos grandes."),
    pageBreak(),
  ];
}

// ─── SECTION 11: Integracion con MENTAT ───────────────────────────────────��───

function s11() {
  return [
    h1("11. Integracion con MENTAT"),
    body(
      "MENTAT es la plataforma de etiquetado colaborativo de imágenes del ecosistema EXPAI. " +
      "Permite a los equipos de anotadores etiquetar imágenes industriales con herramientas " +
      "de anotación de polígonos, rectángulos y segmentación, generando datasets en formato " +
      "YOLO listos para entrenamiento."
    ),
    body(
      "La integración entre MENTAT y la Fábrica de Modelos está diseñada para ser mínima " +
      "y no disruptiva: MENTAT solo necesita añadir la capacidad de exportar al bucket GCS " +
      "compartido; el flujo de trabajo existente de etiquetado y exportación ZIP local " +
      "no se modifica."
    ),

    h2("11.1 Cambios requeridos en MENTAT"),
    h3("11.1.1 Nuevo boton de exportacion"),
    body(
      "Se añade un botón 'Exportar a GCS' en la interfaz de exportación de datasets de " +
      "MENTAT, junto al botón existente de exportación a ZIP local. Al hacer clic, MENTAT " +
      "genera la estructura canónica de directorios en GCS:"
    ),
    ...codeBlock([
      "gs://{bucket}/datasets/{project_name}/{timestamp}/",
      "  data.yaml        <- rutas GCS canonicas",
      "  metadata.json    <- {source: 'mentat', class_count, class_names, image_count, date}",
      "  train/images/    <- imagenes de entrenamiento",
      "  train/labels/    <- etiquetas de entrenamiento (.txt YOLO)",
      "  val/images/      <- imagenes de validacion",
      "  val/labels/      <- etiquetas de validacion (.txt YOLO)",
    ]),

    h3("11.1.2 Credenciales de acceso a GCS"),
    body(
      "MENTAT requiere acceso a GCS con permisos storage.objectAdmin sobre el bucket " +
      "compartido. Las credenciales se configuran mediante la variable de entorno " +
      "GOOGLE_APPLICATION_CREDENTIALS apuntando a un archivo JSON de service account " +
      "con los permisos mínimos necesarios:"
    ),
    ...codeBlock([
      "Roles requeridos en la service account de MENTAT:",
      "  roles/storage.objectAdmin  sobre gs://{bucket}/datasets/",
      "",
      "Variable de entorno:",
      "  GOOGLE_APPLICATION_CREDENTIALS=/path/to/mentat-sa-key.json",
    ]),

    h2("11.2 Descubrimiento automatico de datasets MENTAT"),
    body(
      "La Fábrica de Modelos descubre automáticamente los datasets exportados desde " +
      "MENTAT listando los prefijos bajo gs://bucket/datasets/ en GCS. No requiere " +
      "ninguna notificación o llamada API entre plataformas. El endpoint " +
      "GET /api/datasets/mentat realiza el listado en cada petición y presenta los " +
      "resultados directamente al usuario. Este diseño pull es más simple y resiliente " +
      "que un mecanismo de notificación push, y es suficiente para la frecuencia de " +
      "exportaciones típica en este contexto."
    ),
    pageBreak(),
  ];
}

// ─── SECTION 12: Despliegue y Operaciones ─────────────────────────────────────

function s12() {
  return [
    h1("12. Despliegue y Operaciones"),

    h2("12.1 Requisitos previos"),
    bullet("Cuenta de Google Cloud Platform con proyecto activo."),
    bullet("Bucket GCS creado con reglas de lifecycle configuradas."),
    bullet("Service account con roles: roles/compute.instanceAdmin.v1, roles/storage.objectAdmin."),
    bullet("VM1 creada (e2-standard-4) con Docker y Docker Compose instalados."),
    bullet("VM2 creada (n1-standard-8 + A100) con imagen Deep Learning VM. En estado TERMINATED por defecto."),
    bullet("startup.sh subido a GCS y referenciado en los metadatos de arranque de VM2."),
    bullet("Disco de datos persistente de 150 GB montado en VM1 en /data/extraction/."),

    h2("12.2 Configuracion de variables de entorno"),
    body("Configurar el archivo .env en la raiz del proyecto:"),
    ...codeBlock([
      "# Base de datos PostgreSQL",
      "DATABASE_URL=postgresql://alphaplus:password@db:5432/alphaplus",
      "",
      "# Redis",
      "REDIS_URL=redis://redis:6379/0",
      "",
      "# Google Cloud Storage",
      "GCS_BUCKET=nombre-del-bucket",
      "GCS_PROJECT=id-del-proyecto-gcp",
      "GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/sa-key.json",
      "",
      "# GCP Compute Engine (VM2)",
      "GCP_ZONE=us-central1-a",
      "GPU_VM_NAME=alphaplus-trainer",
      "APP_VM_INTERNAL_IP=10.128.0.X  # IP interna de VM1",
      "",
      "# Almacenamiento local de extraccion",
      "EXTRACTION_PATH=/data/extraction",
    ]),

    h2("12.3 Arranque del sistema"),
    ...codeBlock([
      "# En VM1",
      "cd /opt/alphaplus",
      "docker compose up --build -d",
      "",
      "# Verificar servicios",
      "docker compose ps",
      "docker compose logs backend",
      "",
      "# Ejecutar migraciones de BD (primera vez)",
      "docker compose exec backend alembic upgrade head",
    ]),

    h2("12.4 Verificacion de estado"),
    ...codeBlock([
      "# API health check",
      "curl http://localhost/api/health",
      "",
      "# Estado de Celery workers",
      "docker compose exec worker celery -A app.tasks.celery_app inspect active",
      "",
      "# Estado de VM2",
      "gcloud compute instances describe alphaplus-trainer --zone=us-central1-a",
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 13: Hoja de Ruta ─────────────────────────────────────────────────

function s13() {
  return [
    h1("13. Hoja de Ruta de Desarrollo"),
    body(
      "El desarrollo de la plataforma se articula en cuatro fases secuenciales, " +
      "cada una entregando capacidades operativas incrementales."
    ),

    h2("Fase 1 — Infraestructura base"),
    body("Estado: COMPLETADA", { bold: true }),
    makeTable([
      tRow([tCell("Item", { header: true }), tCell("Descripcion", { header: true }), tCell("Estado", { header: true })]),
      tRow([tCell("Scaffold del proyecto"),       tCell("Docker Compose, estructura de directorios, configuracion de servicios"),                    tCell("Completado")]),
      tRow([tCell("Cliente GCS"),                 tCell("Lectura de datasets, escritura de modelos, upload resumible, atomicidad production.json"),  tCell("Completado")]),
      tRow([tCell("VM lifecycle"),                tCell("Arranque, parada y consulta de estado de VM2 via GCP Compute Engine API"),                 tCell("Completado")]),
      tRow([tCell("Modelo de datos"),             tCell("Tablas datasets, jobs, training_metrics, model_versions en PostgreSQL"),                   tCell("Completado")]),
      tRow([tCell("Disco persistente"),           tCell("Volumen /data/extraction en VM1 para extraccion de ZIPs"),                                 tCell("Completado")]),
      tRow([tCell("Lifecycle rules GCS"),         tCell("Auto-borrado de temp-uploads a los 7 dias, Nearline a los 90 dias"),                       tCell("Completado")]),
    ]),

    h2("Fase 2 — Entrenamiento y Dataset Browser"),
    body("Estado: COMPLETADA", { bold: true }),
    makeTable([
      tRow([tCell("Item", { header: true }), tCell("Descripcion", { header: true }), tCell("Estado", { header: true })]),
      tRow([tCell("Script entrenamiento VM2"),     tCell("train_worker.py con auto-apagado garantizado, callbacks Ultralytics, upload de artefactos"),   tCell("Completado")]),
      tRow([tCell("Dataset Browser"),             tCell("Dos pestanas (MENTAT/Manual), estado en tiempo real, polled status"),                          tCell("Completado")]),
      tRow([tCell("Training Manager"),            tCell("Configuracion de job, historial, curvas de metricas en tiempo real"),                          tCell("Completado")]),
      tRow([tCell("Endpoints de upload"),          tCell("/upload/init, /upload/complete, /{id}/status"),                                              tCell("Completado")]),
      tRow([tCell("Tarea Celery extraccion"),      tCell("extract_dataset_zip: 12 pasos, deteccion de layout, normalizacion, validacion, upload GCS"),  tCell("Completado")]),
      tRow([tCell("Tarea Celery lifecycle"),       tCell("launch_training_job: escritura config GCS, arranque VM2, polling, verificacion resultado"),   tCell("Completado")]),
    ]),

    h2("Fase 3 — Model Registry e Inference"),
    body("Estado: COMPLETADA", { bold: true }),
    makeTable([
      tRow([tCell("Item", { header: true }), tCell("Descripcion", { header: true }), tCell("Estado", { header: true })]),
      tRow([tCell("Model Registry"),           tCell("Catalogo de versiones, comparativa de metricas, descarga de best.pt"),               tCell("Completado")]),
      tRow([tCell("Promocion a produccion"),   tCell("Escritura atomica de production.json con if_generation_match"),                      tCell("Completado")]),
      tRow([tCell("Inference API REST"),       tCell("GET /status, POST /predict. Carga perezosa, cache por (model_name, version)"),       tCell("Completado")]),
    ]),

    h2("Fase 4 — Integracion y Produccion"),
    body("Estado: EN PROGRESO", { bold: true }),
    makeTable([
      tRow([tCell("Item", { header: true }), tCell("Descripcion", { header: true }), tCell("Estado", { header: true })]),
      tRow([tCell("Exportacion MENTAT → GCS"),  tCell("Boton 'Exportar a GCS' en MENTAT con escritura en estructura canonica"),             tCell("Pendiente")]),
      tRow([tCell("Autenticacion JWT"),          tCell("Sistema de autenticacion compartido con MENTAT"),                                    tCell("Pendiente")]),
      tRow([tCell("Alertas de coste"),           tCell("Notificacion si VM GPU supera N horas activa"),                                     tCell("Pendiente")]),
      tRow([tCell("Tests de integracion"),       tCell("Suite E2E: MENTAT → GCS → Fabrica → Inference"),                                   tCell("Pendiente")]),
      tRow([tCell("Pub/Sub GCS"),                tCell("Alternativa al polling para detectar finalizacion de VM2 (reduccion de latencia)"), tCell("Evaluando")]),
    ]),
    pageBreak(),
  ];
}

// ─── SECTION 14: Glosario ─────────────────────────────────────────────────────

function s14() {
  return [
    h1("14. Glosario de Terminos"),
    makeTable([
      tRow([tCell("Termino", { header: true }), tCell("Definicion", { header: true })]),
      tRow([tCell("YOLO"),          tCell("You Only Look Once. Familia de arquitecturas de redes neuronales para deteccion de objetos en tiempo real. Desarrollada originalmente por Joseph Redmon, mantenida actualmente por Ultralytics.")]),
      tRow([tCell("mAP@50"),        tCell("Mean Average Precision calculada con un umbral de IoU de 0.50. Metrica principal para comparar versiones de modelos de deteccion.")]),
      tRow([tCell("mAP@50-95"),     tCell("Mean Average Precision promediada en el rango IoU=[0.50:0.95:0.05]. Metrica mas exigente que mAP@50, usada en la evaluacion COCO.")]),
      tRow([tCell("IoU"),           tCell("Intersection over Union. Metrica de solapamiento entre bounding boxes predichos y ground truth.")]),
      tRow([tCell("GCS"),           tCell("Google Cloud Storage. Servicio de almacenamiento de objetos de Google Cloud Platform.")]),
      tRow([tCell("Resumable Upload"),tCell("Protocolo de GCS para subir archivos grandes en fragmentos, con soporte para reanudacion en caso de interrupcion.")]),
      tRow([tCell("Celery"),        tCell("Sistema distribuido de colas de tareas asincronas para Python. Ejecuta funciones en workers independientes del proceso principal.")]),
      tRow([tCell("FastAPI"),       tCell("Framework web Python moderno basado en ASGI (Starlette + Uvicorn) con validacion automatica via Pydantic y generacion de documentacion OpenAPI.")]),
      tRow([tCell("Docker Compose"),tCell("Herramienta para definir y ejecutar aplicaciones multi-contenedor Docker mediante un archivo YAML de configuracion.")]),
      tRow([tCell("Nginx"),         tCell("Servidor web y proxy inverso de alto rendimiento. En este sistema actua como entrada unica de trafico HTTP en VM1.")]),
      tRow([tCell("MENTAT"),        tCell("Plataforma web de etiquetado colaborativo de imagenes del ecosistema EXPAI. Fuente de datasets para la Fabrica de Modelos.")]),
      tRow([tCell("EXPAI"),         tCell("Proyecto de I+D europeo (EUREKA 21028) centrado en IA interpretable para inspeccion industrial. Marco de referencia de este sistema.")]),
      tRow([tCell("if_generation_match"), tCell("Precondicion de GCS que permite escrituras atomicas: la operacion solo procede si la generacion del objeto coincide con el valor esperado.")]),
      tRow([tCell("production.json"),tCell("Archivo JSON en GCS que contiene un puntero a la version activa del modelo. Leido por la API de Inferencia para cargar el modelo correcto.")]),
      tRow([tCell("best.pt"),       tCell("Archivo de pesos PyTorch del checkpoint con mayor mAP de validacion durante el entrenamiento. Artefacto principal del ciclo de entrenamiento.")]),
      tRow([tCell("data.yaml"),     tCell("Archivo de configuracion del dataset YOLO. Define las rutas de train/val, numero de clases (nc) y nombres de clases (names).")]),
    ]),
    pageBreak(),
  ];
}

// ─── FINAL NOTICE ─────────────────────────────────────────────────────────────

function finalNotice() {
  return [
    new Paragraph({ spacing: { before: 800, after: 200 } }),
    separator(),
    new Paragraph({
      children: [new TextRun({
        text: "Fabrica de Modelos de IA Industrial — Documento Tecnico v1.0 — Marzo 2026",
        color: C.midGrey,
        size: 18,
        italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: "Proyecto EXPAI SmartIndustry (EUREKA 21028)",
        color: C.midGrey,
        size: 18,
        italics: true,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: "PRIVADO Y CONFIDENCIAL — No distribuir sin autorizacion expresa",
        bold: true,
        color: C.red,
        size: 18,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
    }),
  ];
}

// ─── ASSEMBLE DOCUMENT ────────────────────────────────────────────────────────

async function generate() {
  const children = [
    ...coverPage(),
    ...s1(),
    ...s2(),
    ...s3(),
    ...s4(),
    ...s5(),
    ...s6(),
    ...s7(),
    ...s8(),
    ...s9(),
    ...s10(),
    ...s11(),
    ...s12(),
    ...s13(),
    ...s14(),
    ...finalNotice(),
  ];

  const doc = new Document({
    title: "Fabrica de Modelos de IA Industrial — Documento Tecnico",
    description: "Arquitectura e Implementacion — EXPAI SmartIndustry EUREKA 21028",
    creator: "EXPAI SmartIndustry",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: C.darkGrey },
        },
        heading1: {
          run: { bold: true, color: C.navy,   size: 36, font: "Calibri" },
          paragraph: { spacing: { before: 400, after: 160 } },
        },
        heading2: {
          run: { bold: true, color: C.teal,   size: 30, font: "Calibri" },
          paragraph: { spacing: { before: 320, after: 120 } },
        },
        heading3: {
          run: { bold: true, color: C.navy,   size: 26, font: "Calibri" },
          paragraph: { spacing: { before: 240, after: 80 } },
        },
        heading4: {
          run: { bold: true, color: C.teal,   size: 24, font: "Calibri" },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1.0),
              bottom: convertInchesToTwip(1.0),
              left:   convertInchesToTwip(1.25),
              right:  convertInchesToTwip(1.0),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Fabrica de Modelos de IA Industrial", color: C.midGrey, size: 16 }),
                  new TextRun({ text: "   |   EXPAI SmartIndustry — EUREKA 21028", color: C.midGrey, size: 16 }),
                ],
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "PRIVADO Y CONFIDENCIAL — Marzo 2026    ", color: C.midGrey, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: C.midGrey, size: 16 }),
                  new TextRun({ text: " / ", color: C.midGrey, size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: C.midGrey, size: 16 }),
                ],
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const outPath = "C:\\Users\\Alexis\\Downloads\\Fabrica_Modelos_IA_Industrial.docx";
  fs.writeFileSync(outPath, buf);
  console.log("Document written to", outPath, "(" + Math.round(buf.length / 1024) + " KB)");
}

generate().catch(err => { console.error(err); process.exit(1); });
