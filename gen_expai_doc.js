// Script para generar el documento técnico del pipeline EXPAI
const docx = require('C:/nvm4w/nodejs/node_modules/docx');
const fs = require('fs');

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = docx;

// ─── Color palette ───────────────────────────────────────────────────────────
const BLUE_DARK  = "1F3864";
const BLUE_MID   = "2E75B6";
const BLUE_LIGHT = "D5E8F0";
const BLUE_HDR   = "BDD7EE";
const GRAY_TEXT  = "404040";
const WHITE      = "FFFFFF";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function hdrCell(text, widthDXA) {
  return new TableCell({
    borders: cellBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: { fill: BLUE_MID, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: WHITE, size: 20, font: "Arial" })]
    })]
  });
}

function dataCell(text, widthDXA, bold = false, fill = WHITE) {
  return new TableCell({
    borders: cellBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold, size: 18, font: "Arial", color: GRAY_TEXT })]
    })]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun(text)],
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE_MID, space: 4 } }
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun(text)],
    spacing: { before: 280, after: 120 }
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun(text)],
    spacing: { before: 200, after: 80 }
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 60, after: 120, line: 300, lineRule: "auto" },
    children: [new TextRun({ text, size: 20, font: "Arial", color: GRAY_TEXT })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: GRAY_TEXT })]
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: GRAY_TEXT })]
  });
}

function note(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 40, after: 80 },
    indent: { left: 360 },
    children: [new TextRun({ text, size: 18, font: "Arial", italics: true, color: "555555" })]
  });
}

function emptyLine() {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: 0, after: 60 } });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── PORTADA ─────────────────────────────────────────────────────────────────
const coverPage = [
  new Paragraph({ children: [new TextRun("")], spacing: { before: 0, after: 1200 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: "PROYECTO EXPAI SMARTINDUSTRY", bold: true, size: 48, font: "Arial", color: BLUE_DARK })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 320 },
    children: [new TextRun({ text: "21028 EUREKA – ACCURO TECHNOLOGY S.L.", bold: false, size: 24, font: "Arial", color: BLUE_MID })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE_MID, space: 4 } },
    spacing: { before: 0, after: 320 },
    children: [new TextRun("")]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text: "DOCUMENTO TÉCNICO", bold: true, size: 36, font: "Arial", color: BLUE_DARK })]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 480 },
    children: [new TextRun({ text: "Pipeline de Software: Fábrica de Modelos de Inteligencia Artificial", bold: false, size: 28, font: "Arial", color: GRAY_TEXT })]
  }),
  new Paragraph({ children: [new TextRun("")], spacing: { before: 0, after: 600 } }),
  // Metadata table
  new Table({
    width: { size: 6480, type: WidthType.DXA },
    columnWidths: [2160, 4320],
    rows: [
      new TableRow({ children: [
        dataCell("Organización", 2160, true, BLUE_HDR),
        dataCell("ACCURO TECHNOLOGY S.L.", 4320)
      ]}),
      new TableRow({ children: [
        dataCell("Proyecto", 2160, true, BLUE_HDR),
        dataCell("EXPAI SmartIndustry (No. 21028 – EUREKA)", 4320)
      ]}),
      new TableRow({ children: [
        dataCell("Enfoque", 2160, true, BLUE_HDR),
        dataCell("Fábrica de Modelos de IA Industrial a partir de datasets etiquetados", 4320)
      ]}),
      new TableRow({ children: [
        dataCell("Duración", 2160, true, BLUE_HDR),
        dataCell("36 meses (junio 2023 – mayo 2026)", 4320)
      ]}),
      new TableRow({ children: [
        dataCell("Presupuesto ACCURO", 2160, true, BLUE_HDR),
        dataCell("695.429,20 €", 4320)
      ]}),
      new TableRow({ children: [
        dataCell("Versión documento", 2160, true, BLUE_HDR),
        dataCell("1.0 – Marzo 2026", 4320)
      ]}),
    ]
  }),
  pageBreak()
];

// ─── TOC ─────────────────────────────────────────────────────────────────────
const tocSection = [
  h1("Índice de Contenidos"),
  new TableOfContents("Tabla de Contenidos", {
    hyperlink: true,
    headingStyleRange: "1-3",
    stylesWithLevels: [
      { styleName: "Heading1", level: 1 },
      { styleName: "Heading2", level: 2 },
      { styleName: "Heading3", level: 3 },
    ]
  }),
  pageBreak()
];

// ─── SECCIÓN 1: Resumen ejecutivo ────────────────────────────────────────────
const sec1 = [
  h1("1. Resumen Ejecutivo"),
  body("El proyecto EXPAI SmartIndustry (identificador EUREKA 21028) constituye una iniciativa de I+D+i de carácter internacional, liderada en el ámbito español por ACCURO TECHNOLOGY S.L. Su propósito fundamental es investigar, diseñar y desarrollar una plataforma digital inteligente basada en Inteligencia Artificial Explicable (XAI) para la gestión integral de activos automatizables en entornos industriales modernos, enmarcados en los paradigmas de la Industria 4.0 y la emergente Industria 5.0."),
  body("Dentro de la arquitectura global del proyecto, el componente desarrollado por ACCURO se articula bajo el concepto de Fábrica de Modelos de IA (AI Model Factory), cuyo objetivo central es producir, de forma sistemática y reproducible, modelos de Machine Learning y Deep Learning entrenados a partir de datasets etiquetados propios del dominio industrial. Estos modelos alimentan un pipeline de software modular que abarca desde la adquisición de datos sensoriales hasta el despliegue de microservicios inteligentes integrados en robots, cobots y vehículos autónomos."),
  body("El proyecto se estructura en seis actividades principales (A1–A6), con una duración de 36 meses y un presupuesto total asignado a ACCURO de 695.429,20 €. La metodología de desarrollo adoptada es AGILE, ejecutada en sprints multidisciplinares por un equipo de ingenieros de software, doctores en robótica, física y visión computacional."),
  emptyLine()
];

// ─── SECCIÓN 2: Contexto y objetivos ────────────────────────────────────────
const sec2 = [
  h1("2. Contexto del Proyecto y Objetivos"),
  h2("2.1. Marco Tecnológico e Industrial"),
  body("La industria manufacturera contemporánea afronta una transformación radical impulsada por la Industria 4.0, cuyos cuatro pilares son: (i) sistemas ciber-físicos, (ii) sistemas inteligentes con procesamiento en tiempo real, (iii) el Internet de las Cosas (IoT), y (iv) tecnologías robóticas avanzadas. Estudios de mercado internacionales proyectan ahorros de entre el 20 % y el 40 % en costes de producción derivados de la adopción de estas tecnologías."),
  body("EXPAI responde a tres retos críticos detectados en el sector:"),
  bullet("Gestión ineficiente de recursos y mantenimiento reactivo: más del 85 % del coste total del ciclo de vida de una instalación industrial se destina a operación y mantenimiento, mientras que el 55 % de los programas de mantenimiento son de carácter reactivo (post-fallo)."),
  bullet("Errores humanos y seguridad laboral: el 50 % de los problemas de mantenimiento y el 60 % de los informes de mantenimiento se asocian a factores humanos."),
  bullet("Complejidad de la IA como 'caja negra': los sistemas de IA actuales en robótica industrial son opacos para los operarios, dificultando la supervisión, la detección de fallos y la toma de decisiones."),
  emptyLine(),
  h2("2.2. Objetivos Técnicos del Proyecto"),
  body("El objetivo principal del proyecto es desarrollar una solución software capaz de gestionar, de forma optimizada, la operativa de producción y mantenimiento en entornos con robots industriales, cobots y AMRs (Autonomous Mobile Robots). Los objetivos técnicos específicos incluyen:"),
  numbered("Diseñar un sistema de recopilación de datos mediante sensores para minimizar el consumo energético en producción."),
  numbered("Desarrollar algoritmos de procesamiento de información sensorial, con especial énfasis en un sistema completo de Visión Artificial (VA)."),
  numbered("Crear un framework controlable e integrable en múltiples dominios industriales."),
  numbered("Implementar un sistema de control centralizado con visualización de datos para usuarios finales."),
  numbered("Desarrollar algoritmos de detección de anomalías para mantenimiento predictivo y preventivo."),
  numbered("Diseñar algoritmos de colaboración operario-robot (Human-Robot Collaboration, HRC)."),
  numbered("Desarrollar hardware específico para integración con robots y AMRs."),
  numbered("Implementar planes de mantenimiento inteligentes basados en pronóstico."),
  numbered("Optimizar el consumo energético: reducción del 15 % en AMRs y ahorro del 30 % en líneas de fabricación."),
  numbered("Implementar IA Explicable (XAI) para que los usuarios finales comprendan el razonamiento de los modelos."),
  numbered("Desarrollar un Decision Support System (DSS) inteligente para optimización de rutas y planificación."),
  emptyLine()
];

// ─── SECCIÓN 3: Arquitectura general ────────────────────────────────────────
const sec3 = [
  h1("3. Arquitectura General del Sistema EXPAI"),
  body("La plataforma EXPAI se estructura en tres niveles de abstracción diferenciados, que integran componentes hardware y software en una arquitectura abierta e interoperable:"),
  emptyLine(),
  // Architecture table
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2780, 4780],
    rows: [
      new TableRow({ children: [
        hdrCell("Nivel", 1800),
        hdrCell("Capa", 2780),
        hdrCell("Componentes principales", 4780)
      ]}),
      new TableRow({ children: [
        dataCell("Nivel 1 (Edge)", 1800, true, BLUE_LIGHT),
        dataCell("Sensórica y adquisición", 2780),
        dataCell("Cámaras inteligentes (NVIDIA Jetson Nano / AGX Xavier), sensores IoT/IIoT, lentes de imagen, módulos de conectividad OPC UA", 4780)
      ]}),
      new TableRow({ children: [
        dataCell("Nivel 2 (Middleware)", 1800, true, BLUE_LIGHT),
        dataCell("Procesamiento local e integración", 2780),
        dataCell("Algoritmos de fusión de sensores, pipelines de preprocesamiento, módulos de inferencia en tiempo real, PLCs y buses de campo", 4780)
      ]}),
      new TableRow({ children: [
        dataCell("Nivel 3 (Cloud)", 1800, true, BLUE_LIGHT),
        dataCell("Plataforma central y DSS", 2780),
        dataCell("Almacenamiento de datasets etiquetados, entrenamiento de modelos de IA, framework XAI, Decision Support System, API REST/microservicios", 4780)
      ]}),
    ]
  }),
  emptyLine(),
  body("La comunicación entre niveles se sustenta sobre el estándar IEC 62541 OPC UA (OPC Unified Architecture), una arquitectura multiplataforma de código abierto que garantiza la interoperabilidad entre dispositivos, máquinas y sistemas en la nube, independientemente del sistema operativo o lenguaje de programación subyacente."),
  body("Los componentes hardware (Nivel 1) operan bajo arquitectura Edge Computing: procesan localmente las imágenes capturadas y transmiten únicamente los resultados de la inferencia hacia la nube, reduciendo la latencia y la carga de red. El Nivel 3 actúa como repositorio centralizado de modelos, datos históricos e indicadores agregados, accesible en tiempo real desde cualquier punto de la planta."),
  emptyLine()
];

// ─── SECCIÓN 4: Pipeline ─────────────────────────────────────────────────────
const sec4 = [
  h1("4. Pipeline de Software: Fábrica de Modelos de IA"),
  body("El pipeline de la Fábrica de Modelos de IA constituye el núcleo tecnológico del proyecto EXPAI desde la perspectiva de ACCURO. Se concibe como un flujo de trabajo estructurado en etapas secuenciales e iterativas que transforma datos sensoriales brutos en modelos de IA desplegados, validados y explicables. Las ocho etapas se describen a continuación."),
  emptyLine(),

  h2("4.1. Etapa 1 – Adquisición y Sensorización"),
  body("El punto de entrada del pipeline es la captura de datos del entorno industrial mediante dispositivos hardware específicos. Los sensores primarios son cámaras inteligentes con capacidad de cómputo embebido, complementadas por sensores adicionales (LiDAR, RFID, sensores de proximidad) según el caso de uso."),
  body("Componentes de adquisición:"),
  bullet("Cámaras con diferentes configuraciones ópticas: gran angular, ojo de pez, estándar y termográfica."),
  bullet("Sensores de imagen de tipo CCD, CMOS rolling shutter, global shutter y event-based."),
  bullet("Lentes de longitud focal fija o zoom, seleccionadas según el campo de visión y la profundidad requerida."),
  bullet("Módulos de conectividad (Ethernet, Wi-Fi) para transmisión de datos a sistemas superiores."),
  body("Los datos capturados incluyen: vídeo en alta resolución, imágenes térmicas, datos de posición y datos de estado de los robots (odometría, corriente de motores, temperatura)."),
  emptyLine(),

  h2("4.2. Etapa 2 – Preprocesamiento y Normalización"),
  body("Los datos crudos son procesados localmente en la placa computadora integrada (NVIDIA Jetson) antes de ser transmitidos. Esta etapa aplica técnicas de tratamiento digital de imágenes para mejorar la calidad y homogeneidad de los datos de entrada a los modelos:"),
  bullet("Filtrado de ruido (filtros gaussianos, mediana)."),
  bullet("Normalización de histograma y ajuste de exposición."),
  bullet("Corrección de distorsión de lente (especialmente en lentes ojo de pez)."),
  bullet("Reescalado y recorte (cropping) para adecuar las imágenes a la resolución de entrada de los modelos."),
  bullet("Data augmentation: rotaciones, flips horizontales/verticales, variaciones de brillo y contraste para enriquecer los datasets de entrenamiento."),
  body("El procesamiento de señales digitales (DSP) integrado en el procesador de imagen del dispositivo hardware también ejecuta tareas de extracción de características de bajo nivel antes de la transmisión."),
  emptyLine(),

  h2("4.3. Etapa 3 – Etiquetado y Gestión de Datasets"),
  body("Esta etapa constituye el núcleo de la Fábrica de Modelos: a partir de los datos preprocesados se construyen los datasets etiquetados que servirán como insumo para el entrenamiento supervisado. El ciclo de gestión de datasets comprende:"),
  numbered("Definición de clases y taxonomía de etiquetas según el caso de uso (defectos de calidad, tipos de objetos, estados de seguridad, posiciones de robots, etc.)."),
  numbered("Anotación semántica: bounding boxes, segmentación de instancias, etiquetas de clasificación, keypoints para detección de posturas humanas."),
  numbered("Control de calidad del etiquetado: revisión cruzada entre anotadores, cálculo de métricas de concordancia inter-anotador."),
  numbered("División estratificada del dataset: conjuntos de entrenamiento (train), validación (validation) y prueba (test), garantizando representatividad de todas las clases."),
  numbered("Versionado de datasets: registro de versiones para reproducibilidad de experimentos."),
  body("El proyecto contempla el uso de aprendizaje supervisado (datasets completamente etiquetados), aprendizaje semisupervisado (datasets parcialmente etiquetados) y aprendizaje no supervisado para la detección de anomalías sin etiquetas previas."),
  emptyLine(),

  h2("4.4. Etapa 4 – Diseño de Algoritmos y Arquitecturas de Modelos"),
  body("Con el dataset disponible, el equipo de I+D diseña las arquitecturas de los modelos de IA. Los principales paradigmas de diseño utilizados son:"),
  bullet("Redes Neuronales Convolucionales (CNN): arquitectura de facto para procesamiento de imágenes; eficientes en la extracción de características espaciales mediante ventanas convolucionales, evitando el procesamiento píxel a píxel."),
  bullet("Redes Neuronales Recurrentes (RNN / LSTM / GRU): para análisis de secuencias temporales, como series de datos de sensores o detección de trayectorias de robots."),
  bullet("Modelos de detección de objetos (YOLO, SSD, Faster R-CNN): para localización y clasificación de objetos en tiempo real dentro de la línea de producción."),
  bullet("Modelos de segmentación de instancias: para separar y caracterizar objetos individuales en escenas complejas."),
  bullet("Algoritmos de estimación de pose: utilizando bibliotecas como OpenPose para la detección de posturas humanas y colaboración humano-robot."),
  bullet("Modelos 3D (fotogrametría y reconstrucción estéreo): para generar representaciones tridimensionales de componentes industriales a partir de imágenes capturadas desde múltiples ángulos."),
  bullet("Support Vector Machines (SVM) y K-Nearest Neighbors (KNN): para tareas de clasificación de menor complejidad o como clasificadores de apoyo."),
  body("Las herramientas y frameworks de referencia incluyen TensorFlow y OpenPose, con implementaciones optimizadas para el hardware NVIDIA Jetson mediante la librería TensorRT."),
  emptyLine(),

  h2("4.5. Etapa 5 – Entrenamiento, Evaluación y Selección de Modelos"),
  body("El entrenamiento de los modelos se realiza en la capa Cloud, donde se dispone de mayor capacidad computacional para el procesamiento de grandes volúmenes de imágenes. El ciclo de entrenamiento-evaluación sigue las siguientes prácticas:"),
  numbered("Entrenamiento con optimizadores estocásticos (Adam, SGD con momentum) y técnicas de regularización (dropout, batch normalization, weight decay)."),
  numbered("Monitorización de métricas durante el entrenamiento: pérdida (loss), precisión (accuracy), F1-score, mAP (mean Average Precision) para detección de objetos, IoU (Intersection over Union) para segmentación."),
  numbered("Validación cruzada k-fold para estimación robusta del rendimiento generalizable."),
  numbered("Selección del mejor modelo según los KPIs definidos en la Actividad 2 del plan de trabajo."),
  numbered("Análisis de matrices de confusión y curvas ROC para caracterización del error."),
  numbered("Evaluación de velocidad de inferencia (frames por segundo) en el hardware Jetson de destino para validar los requisitos de tiempo real."),
  body("Aquellos modelos que proporcionen resultados satisfactorios son promovidos a la siguiente etapa para su despliegue como microservicios de producción."),
  emptyLine(),

  h2("4.6. Etapa 6 – Despliegue como Microservicios"),
  body("Los modelos validados se encapsulan como microservicios independientes dentro de la plataforma EXPAI. Cada microservicio expone una API que permite su consumo por otros módulos del sistema (interfaz de usuario, DSS, sistemas ERP/MES). Esta arquitectura de microservicios proporciona:"),
  bullet("Escalabilidad horizontal: nuevos modelos pueden añadirse sin reconfigurar el sistema completo."),
  bullet("Independencia tecnológica: cada microservicio puede implementarse en el lenguaje y versión de framework más adecuados."),
  bullet("Despliegue dual Edge/Cloud: los modelos de inferencia en tiempo real se despliegan en los dispositivos Jetson (Edge), mientras que los modelos de análisis de tendencias y entrenamiento periódico residen en la nube (Cloud)."),
  bullet("Versionado de modelos en producción: permite A/B testing y rollback ante degradación de rendimiento."),
  emptyLine(),

  h2("4.7. Etapa 7 – Framework de IA Explicable (XAI)"),
  body("La IA Explicable (Explainable AI, XAI) constituye la funcionalidad core de la plataforma EXPAI y una exigencia transversal a todos los modelos desplegados. El framework XAI desarrollado en la Tarea T3.4 proporciona:"),
  bullet("Transparencia algorítmica: capacidad de explicar, en términos comprensibles para operarios no expertos, por qué un modelo toma una determinada decisión."),
  bullet("Mapas de saliencia y Grad-CAM (Gradient-weighted Class Activation Mapping): visualizaciones que indican qué regiones de la imagen son responsables de la predicción del modelo."),
  bullet("Análisis de importancia de características (feature importance): cuantificación de la contribución relativa de cada variable de entrada a la salida del modelo."),
  bullet("Evaluación de riesgos situacionales: los modelos XAI se aplican para la evitación de colisiones en robots móviles y para la valoración de riesgos de seguridad laboral."),
  bullet("Interoperabilidad y fiabilidad: el framework es estándar para todos los dominios del consorcio EXPAI."),
  body("Esta capa de explicabilidad es fundamental para garantizar la aceptación y confianza de los operarios en el sistema, reduciendo los errores de procedimiento asociados al factor humano."),
  emptyLine(),

  h2("4.8. Etapa 8 – Sistema de Apoyo a la Toma de Decisiones (DSS)"),
  body("El Decision Support System (DSS) integra las salidas de todos los modelos desplegados en un sistema de soporte de alto nivel que asiste a los responsables de planta y operarios en la toma de decisiones operativas. Sus capacidades incluyen:"),
  bullet("Evaluación de riesgos: identificación y priorización de situaciones de riesgo para la seguridad laboral y la integridad de los equipos."),
  bullet("Escenarios pronósticos (forecasting): predicción del estado futuro de los equipos para anticipar fallos y planificar intervenciones de mantenimiento preventivo."),
  bullet("Planificación de rutas multi-robot: optimización dinámica de las trayectorias de flotas de AMRs minimizando el consumo energético y los tiempos de ciclo."),
  bullet("Detección de anomalías: identificación en tiempo real de patrones anómalos en el funcionamiento de los equipos y en la producción."),
  bullet("Gestión de inventario automatizada: monitorización en tiempo real de existencias mediante visión artificial, con generación automática de alertas a los sistemas ERP/MES/SGA."),
  emptyLine()
];

// ─── SECCIÓN 5: Tecnologías ───────────────────────────────────────────────────
const sec5 = [
  h1("5. Tecnologías e Implementaciones"),
  h2("5.1. Tecnologías Hardware"),
  body("El subsistema hardware de EXPAI está diseñado ad hoc para el despliegue de algoritmos de visión artificial en entornos de fabricación avanzada. Los componentes clave son:"),
  emptyLine(),
  // Hardware tech table
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 3200, 3960],
    rows: [
      new TableRow({ children: [
        hdrCell("Componente", 2200),
        hdrCell("Especificación", 3200),
        hdrCell("Función en el pipeline", 3960)
      ]}),
      new TableRow({ children: [
        dataCell("NVIDIA Jetson Nano", 2200, true, BLUE_LIGHT),
        dataCell("CPU Quad-core ARM A57, GPU 128-core Maxwell, 4 GB RAM LPDDR4", 3200),
        dataCell("Ejecución de redes neuronales livianas, inferencia en tiempo real para vigilancia de entorno y control de calidad básico", 3960)
      ]}),
      new TableRow({ children: [
        dataCell("NVIDIA Jetson AGX Xavier Industrial", 2200, true, BLUE_LIGHT),
        dataCell("CPU 8-core ARM v8.2, GPU 512-core Volta + 64 Tensor Cores, 16 GB RAM, rango de temperatura extendido", 3200),
        dataCell("Inferencia de modelos complejos (detección de objetos, reconstrucción 3D) en máquinas autónomas y robots de logística de alto rendimiento", 3960)
      ]}),
      new TableRow({ children: [
        dataCell("Cámara gran angular / ojo de pez", 2200, true, BLUE_LIGHT),
        dataCell("Lente < 2.8 mm focal, sensor CMOS global shutter", 3200),
        dataCell("Monitorización amplia del entorno de producción y detección de personas", 3960)
      ]}),
      new TableRow({ children: [
        dataCell("Cámara termográfica", 2200, true, BLUE_LIGHT),
        dataCell("Sensor infrarrojo térmico (LWIR)", 3200),
        dataCell("Detección de puntos calientes en equipos, mantenimiento predictivo térmico", 3960)
      ]}),
      new TableRow({ children: [
        dataCell("Sistema de refrigeración", 2200, true, BLUE_LIGHT),
        dataCell("Disipador + ventilador activo", 3200),
        dataCell("Estabilidad térmica en entornos industriales de alta temperatura", 3960)
      ]}),
      new TableRow({ children: [
        dataCell("OPC UA (IEC 62541)", 2200, true, BLUE_LIGHT),
        dataCell("Estándar multiplataforma TCP/IP", 3200),
        dataCell("Comunicación M2M estandarizada entre sensores, PLCs, cobots y sistemas en nube", 3960)
      ]}),
    ]
  }),
  emptyLine(),
  h2("5.2. Tecnologías Software e Inteligencia Artificial"),
  body("El stack tecnológico de software integra herramientas de deep learning, procesamiento de imágenes, computación distribuida y comunicaciones industriales:"),
  emptyLine(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 3000, 3760],
    rows: [
      new TableRow({ children: [
        hdrCell("Tecnología / Framework", 2600),
        hdrCell("Categoría", 3000),
        hdrCell("Aplicación en EXPAI", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("TensorFlow / Keras", 2600, true, BLUE_LIGHT),
        dataCell("Framework Deep Learning", 3000),
        dataCell("Diseño, entrenamiento y exportación de modelos CNN, RNN/LSTM para visión artificial y análisis de series temporales", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("NVIDIA TensorRT", 2600, true, BLUE_LIGHT),
        dataCell("Optimización de inferencia", 3000),
        dataCell("Compilación y cuantización de modelos para despliegue optimizado en hardware Jetson (reducción de latencia y consumo)", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("OpenPose", 2600, true, BLUE_LIGHT),
        dataCell("Estimación de pose humana", 3000),
        dataCell("Detección de posturas de operarios para colaboración segura humano-robot (HRC) y verificación de normas de seguridad", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("SLAM (Simultaneous Localization and Mapping)", 2600, true, BLUE_LIGHT),
        dataCell("Navegación autónoma", 3000),
        dataCell("Generación de mapas del entorno de fábrica y posicionamiento de AMRs en tiempo real sin rutas preestablecidas", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("CNN (Convolutional Neural Networks)", 2600, true, BLUE_LIGHT),
        dataCell("Arquitectura Deep Learning", 3000),
        dataCell("Extracción de características visuales, detección de defectos, clasificación de productos, lectura de códigos de barras", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("LSTM / GRU", 2600, true, BLUE_LIGHT),
        dataCell("Redes recurrentes temporales", 3000),
        dataCell("Análisis predictivo de series temporales de sensores para mantenimiento predictivo y optimización energética", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("SVM / KNN", 2600, true, BLUE_LIGHT),
        dataCell("Machine Learning clásico", 3000),
        dataCell("Clasificación auxiliar, detección de anomalías en conjuntos de datos de baja dimensionalidad", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("Grad-CAM / SHAP / LIME", 2600, true, BLUE_LIGHT),
        dataCell("Explainable AI (XAI)", 3000),
        dataCell("Generación de explicaciones visuales y estadísticas de las predicciones de los modelos para los operarios", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("Edge Computing (Jetson) + Cloud Computing", 2600, true, BLUE_LIGHT),
        dataCell("Infraestructura distribuida", 3000),
        dataCell("Procesamiento en tiempo real en Edge; almacenamiento, entrenamiento y análisis de tendencias en Cloud. Modelo híbrido.", 3760)
      ]}),
      new TableRow({ children: [
        dataCell("Microservicios REST / API", 2600, true, BLUE_LIGHT),
        dataCell("Arquitectura de integración", 3000),
        dataCell("Despliegue modular de modelos de IA; integración con ERP, MES y SGA industriales", 3760)
      ]}),
    ]
  }),
  emptyLine(),
  h2("5.3. Infraestructura de Computación: Modelo Híbrido Edge-Cloud"),
  body("ACCURO propone un modelo híbrido de computación que explota simultáneamente las ventajas del Edge Computing y del Cloud Computing:"),
  bullet("Edge Computing (NVIDIA Jetson): Las cámaras inteligentes procesan localmente las imágenes capturadas, ejecutando los modelos de inferencia en tiempo real directamente en el dispositivo de adquisición. Esto proporciona baja latencia (crítica para la colaboración humano-robot y el control de calidad en línea), procesamiento descentralizado y reducción del volumen de datos transmitidos a la nube."),
  bullet("Cloud Computing: La información detectada en las imágenes se envía a la nube, donde se aplican algoritmos de detección de patrones, cálculo de KPIs, análisis de tendencias y entrenamiento periódico de nuevas versiones de los modelos. Garantiza la seguridad de los datos, la accesibilidad centralizada y la escalabilidad del sistema."),
  body("La combinación de ambos paradigmas permite reducir simultáneamente: (a) la carga de transmisión de datos, (b) la carga computacional del centro de procesamiento, y (c) el uso de almacenamiento, al no requerir conservar las imágenes brutas una vez procesadas."),
  emptyLine()
];

// ─── SECCIÓN 6: Módulos funcionales ──────────────────────────────────────────
const sec6 = [
  h1("6. Módulos Funcionales del Sistema"),
  body("El sistema EXPAI se descompone en módulos funcionales que corresponden a las tareas del Paquete de Trabajo 3 (A3 – Methods & Algorithms Development). Cada módulo encapsula un conjunto de algoritmos especializados y expone interfaces estandarizadas para su integración en la plataforma global."),
  emptyLine(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 2160, 4800],
    rows: [
      new TableRow({ children: [
        hdrCell("Módulo", 2400),
        hdrCell("Tarea EXPAI", 2160),
        hdrCell("Descripción funcional", 4800)
      ]}),
      new TableRow({ children: [
        dataCell("Módulo de Adquisición y Preprocesamiento (T3.2)", 2400, true, BLUE_LIGHT),
        dataCell("T3.2", 2160),
        dataCell("Marco de ingestión de datos para centralizar puntos de datos de casos de uso. Incluye módulos middleware de fusión de sensores para incrementar la eficiencia del procesamiento.", 4800)
      ]}),
      new TableRow({ children: [
        dataCell("Módulo de Modelos de IA (T3.3)", 2400, true, BLUE_LIGHT),
        dataCell("T3.3", 2160),
        dataCell("Diseño, implementación, evaluación y despliegue de modelos de IA como microservicios. Los modelos se orientan a casos de uso específicos: detección de defectos, guiado de robots, análisis de inventario.", 4800)
      ]}),
      new TableRow({ children: [
        dataCell("Framework XAI (T3.4)", 2400, true, BLUE_LIGHT),
        dataCell("T3.4", 2160),
        dataCell("Marco estándar de IA Explicable que explica las predicciones de los modelos desplegados. Garantiza transparencia, interoperabilidad y fiabilidad para todos los dominios del proyecto.", 4800)
      ]}),
      new TableRow({ children: [
        dataCell("Decision Support System (T3.5)", 2400, true, BLUE_LIGHT),
        dataCell("T3.5", 2160),
        dataCell("Sistema de apoyo a la toma de decisiones basado en IA transparente. Integra evaluación de riesgos, pronóstico, planificación de rutas y detección de anomalías en un único sistema transversal.", 4800)
      ]}),
      new TableRow({ children: [
        dataCell("Módulo de Interfaces de Usuario (T3.1)", 2400, true, BLUE_LIGHT),
        dataCell("T3.1", 2160),
        dataCell("Interfaz front-end y back-end para visualización de resultados, alertas y KPIs. Capa de reporting para responsables de planta.", 4800)
      ]}),
      new TableRow({ children: [
        dataCell("Módulo de Integración de Sistemas (A4)", 2400, true, BLUE_LIGHT),
        dataCell("T4.2", 2160),
        dataCell("Integración de todos los módulos en el framework EXPAI. Define formatos de datos y protocolos de comunicación entre bloques, verificando la interoperabilidad.", 4800)
      ]}),
    ]
  }),
  emptyLine()
];

// ─── SECCIÓN 7: Casos de uso ──────────────────────────────────────────────────
const sec7 = [
  h1("7. Casos de Uso Industriales"),
  body("La plataforma de visión artificial de ACCURO está orientada a resolver situaciones recurrentes en la industria que pueden ser abordadas mediante algoritmos de IA y visión por computador. Los nueve casos de uso principales son:"),
  emptyLine(),
  numbered("Líneas de montaje asistidas por robots: supervisión y guiado continuo de brazos robóticos y cobots que colaboran con operarios en tareas diversas. El sistema de VA mide los movimientos del operario y coordina la acción del robot para evitar interferencias."),
  numbered("Detección de defectos de calidad: algoritmos de Machine Learning analizan flujos de vídeo en tiempo real para detectar defectos visuales en los productos y desviarlos automáticamente de la línea de producción."),
  numbered("Reconstrucción 3D de componentes: el sistema captura imágenes desde múltiples ángulos para generar modelos tridimensionales precisos de los componentes. Los modelos 3D sirven como patrón de referencia para la inspección visual."),
  numbered("Troquelado y corte guiado por VA: el sistema de visión guía máquinas de troquelado (láser o rotativo) una vez que el patrón de diseño alimenta el algoritmo, ejecutando cortes de alta precisión."),
  numbered("Mantenimiento predictivo: monitorización continua de equipos a través de métricas visuales y térmicas. Las desviaciones de los valores normales activan alertas proactivas de mantenimiento."),
  numbered("Verificación de normas de seguridad laboral: detección de incumplimientos de EPIs (Equipos de Protección Individual), identificación de situaciones de riesgo y generación de alertas al gerente y al personal."),
  numbered("Normas de embalaje y conteo de piezas: verificación automática del número de piezas embaladas y de la integridad del embalaje, minimizando errores humanos costosos en sectores farmacéutico y minorista."),
  numbered("Verificación y análisis de códigos de barras: comprobación de legibilidad y exactitud de códigos de barras de miles de productos de forma automatizada y sin errores por descuido."),
  numbered("Gestión inteligente de inventario: localización de existencias en almacén, conteo automatizado de stock y generación de alertas de escasez para los sistemas ERP/MES/SGA."),
  emptyLine()
];

// ─── SECCIÓN 8: Plan de trabajo ───────────────────────────────────────────────
const sec8 = [
  h1("8. Plan de Trabajo y Metodología"),
  h2("8.1. Estructura de Actividades"),
  body("El proyecto se estructura en seis actividades (A1–A6) ejecutadas a lo largo de 36 meses:"),
  emptyLine(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 2200, 2160, 4200],
    rows: [
      new TableRow({ children: [
        hdrCell("ID", 800),
        hdrCell("Actividad", 2200),
        hdrCell("Período", 2160),
        hdrCell("Descripción", 4200)
      ]}),
      new TableRow({ children: [
        dataCell("A1", 800, true, BLUE_LIGHT),
        dataCell("Gestión del Proyecto", 2200),
        dataCell("M1–M36", 2160),
        dataCell("Administración de la gobernanza, hitos, normas de gestión y riesgos del proyecto.", 4200)
      ]}),
      new TableRow({ children: [
        dataCell("A2", 800, true, BLUE_LIGHT),
        dataCell("Requisitos y Arquitectura del Sistema", 2200),
        dataCell("M1–M31", 2160),
        dataCell("Definición de casos de uso, KPIs, especificación de la arquitectura de la plataforma y los módulos.", 4200)
      ]}),
      new TableRow({ children: [
        dataCell("A3", 800, true, BLUE_LIGHT),
        dataCell("Desarrollo de Métodos y Algoritmos", 2200),
        dataCell("M13–M30", 2160),
        dataCell("Implementación de pipelines de datos, modelos de IA, framework XAI y DSS.", 4200)
      ]}),
      new TableRow({ children: [
        dataCell("A4", 800, true, BLUE_LIGHT),
        dataCell("Integración y Pruebas de Interoperabilidad", 2200),
        dataCell("M13–M36", 2160),
        dataCell("Integración de módulos hardware y software. Verificación y validación del sistema completo.", 4200)
      ]}),
      new TableRow({ children: [
        dataCell("A5", 800, true, BLUE_LIGHT),
        dataCell("Demostración y Evaluación", 2200),
        dataCell("M9–M36", 2160),
        dataCell("Validación de módulos y algoritmos en casos de uso reales. Evaluación de KPIs.", 4200)
      ]}),
      new TableRow({ children: [
        dataCell("A6", 800, true, BLUE_LIGHT),
        dataCell("Diseminación y Explotación", 2200),
        dataCell("M4–M36", 2160),
        dataCell("Difusión de resultados, explotación comercial, gestión de propiedad intelectual y estandarización.", 4200)
      ]}),
    ]
  }),
  emptyLine(),
  h2("8.2. Fases Propias de ACCURO"),
  body("Dentro de las actividades del consorcio, ACCURO ejecuta cuatro fases técnicas propias:"),
  numbered("Fase 1: Requisitos del Caso de Uso y Arquitectura del Sistema. Definición de los casos de uso de visión artificial y análisis de requisitos para la integración en la plataforma EXPAI global."),
  numbered("Fase 2: Diseño y Desarrollo de Elementos Hardware. Diseño de la cámara inteligente, desarrollo del prototipo (Jetson + óptica), diseño de interfaces hardware y diseño e impresión 3D de las protecciones."),
  numbered("Fase 3: Diseño y Desarrollo de Elementos Software. Diseño y desarrollo de los algoritmos de IA, interfaces software e integración con la plataforma."),
  numbered("Fase 4: Integración, Validación y Demostración. Integración de elementos software y hardware, pruebas de validación y desarrollo del demostrador industrial."),
  emptyLine(),
  h2("8.3. Metodología AGILE"),
  body("La metodología de desarrollo adoptada en el proyecto es AGILE, con ejecución en sprints multidisciplinares. Las tareas son asumidas por todo el equipo de forma coordinada, sin una separación rígida entre perfiles. Las responsabilidades se distribuyen según la especialización:"),
  bullet("Doctores (Robótica, IA, Física): definición de requisitos, investigación del estado del arte, diseño de algoritmos y validación."),
  bullet("Titulados Superiores (Ingeniería Informática, Software): liderazgo técnico, diseño detallado de todos los módulos software y hardware, arquitectura de la capa Edge y Cloud Computing."),
  bullet("Titulados Medios: desarrollo de código, módulos, interfaces y sistemas diseñados por el equipo superior; feedback de diseño y participación en validación."),
  emptyLine()
];

// ─── SECCIÓN 9: Equipo ────────────────────────────────────────────────────────
const sec9 = [
  h1("9. Equipo Técnico e Infraestructura"),
  h2("9.1. Equipo de Proyecto"),
  body("El equipo técnico de ACCURO adscrito al proyecto EXPAI es multidisciplinar y altamente cualificado, reuniendo perfiles de ingeniería de software, robótica, visión artificial, física y administración de proyectos de I+D:"),
  emptyLine(),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 3360, 3600],
    rows: [
      new TableRow({ children: [
        hdrCell("Nombre", 2400),
        hdrCell("Titulación", 3360),
        hdrCell("Rol en el proyecto", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Becerro Abajo, Iván", 2400, true, BLUE_LIGHT),
        dataCell("Grado en Ingeniería del Software, Grado en Computación", 3360),
        dataCell("Director Técnico de I+D+i – Liderazgo global, requisitos y validación", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Cobos Guzmán, Salvador", 2400, true, BLUE_LIGHT),
        dataCell("Doctor en Robótica y Automática", 3360),
        dataCell("Investigador Principal – Casos de uso, IoT, diseño de algoritmos", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Fonseca Luengo, Denys", 2400, true, BLUE_LIGHT),
        dataCell("Grado CS, Máster Ing. Software, Doctorado en IA con Visión Computacional (en curso)", 3360),
        dataCell("Investigador – VA: modelos 3D, detección de defectos, localización de objetos", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Ayala Arranz, David F.", 2400, true, BLUE_LIGHT),
        dataCell("Ingeniería Superior en Informática (Software de Gestión)", 3360),
        dataCell("Diseño y desarrollo de todos los algoritmos de IA del proyecto", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Martín Sánchez, Carlos", 2400, true, BLUE_LIGHT),
        dataCell("Ingeniería Técnica e Ingeniería Superior en Informática", 3360),
        dataCell("Full-Stack – Edge Computing y Cloud Computing", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Tórrego Moreno, Irene", 2400, true, BLUE_LIGHT),
        dataCell("Grado en Física, Máster en Meteorología y Geofísica", 3360),
        dataCell("Interfaces hardware de cámaras, modelos 3D y guiado de robots", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Cano Rodríguez, Héctor", 2400, true, BLUE_LIGHT),
        dataCell("Ingeniería Técnica en Informática de Gestión", 3360),
        dataCell("Diseño y desarrollo de interfaces de usuario, BBDD y comunicación con algoritmos", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Valverde Lorenzo, Álvaro", 2400, true, BLUE_LIGHT),
        dataCell("Técnico Superior en Sistemas de Telecomunicaciones e Informáticos", 3360),
        dataCell("Desarrollador – Código, módulos, interfaces y sistemas", 3600)
      ]}),
      new TableRow({ children: [
        dataCell("Colome Roncero, Francisco", 2400, true, BLUE_LIGHT),
        dataCell("Grado Superior en Desarrollo de Aplicaciones Informáticas", 3360),
        dataCell("Desarrollador – Código, módulos, interfaces y sistemas", 3600)
      ]}),
    ]
  }),
  emptyLine(),
  h2("9.2. Colaboraciones Externas"),
  body("ACCURO colabora con LEITAT para los aspectos de microelectrónica, circuitos de la cámara y diseño e impresión 3D de las protecciones de los dispositivos (tareas T2.2 y T2.5). LEITAT aporta laboratorios especializados y capacidades de fabricación aditiva para la producción de las carcasas de los prototipos."),
  body("A nivel académico, ACCURO mantiene colaboraciones activas con la Universidad Internacional de La Rioja (UNIR) y el centro tecnológico FUNDITEC, reforzando la base investigadora del equipo y el acceso a publicaciones de vanguardia."),
  emptyLine()
];

// ─── SECCIÓN 10: Referencias ──────────────────────────────────────────────────
const sec10 = [
  h1("10. Referencias Bibliográficas"),
  note("[1] Randstad. «El futuro laboral del sector de la industria manufacturera». 2017."),
  note("[2] B. Feng y Q. Ye. «Operations management of smart logistics: A literature review and future research». Front. Eng. Manag., vol. 8, n.o 3, pp. 344-355, 2021."),
  note("[3] European Commission. «Industry 5.0». Directorate-General for Research and Innovation. https://research-and-innovation.ec.europa.eu/research-area/industrial-research-and-innovation/industry-50_en."),
  note("[4] European Commission / J. Müller. «Enabling Technologies for Industry 5.0». Publications Office, 2020. doi: 10.2777/082634."),
  note("[5] E. Matheson et al. «Human-Robot Collaboration in Manufacturing Applications: A Review». Robotics, vol. 8, n.o 4, 2019. doi: 10.3390/robotics8040100."),
  note("[6] E. Teicholz et al. «Facility Design and Management Handbook». McGraw-Hill, 2004."),
  note("[7] Gulati, R. «Maintenance and Reliability Best Practices». Industrial Press, 2009."),
  note("[8] S. Bragança et al. «A Brief Overview of the Use of Collaborative Robots in Industry 4.0». Studies in Systems, Decision and Control, vol. 202, Springer, 2019."),
  note("[9] F. Sherwani et al. «Collaborative Robots and Industrial Revolution 4.0 (IR 4.0)». IEEE ICETST, 2020. doi: 10.1109/ICETST49965.2020.9080724."),
  note("[10] Next Move Strategy Consulting. «Explainable AI Market Size, Share». 2021."),
  note("[11] Ningbo Kasus Automation Technology Co. «CN105865333 Semi-automatic multi-angle machine vision detector». 2016."),
  note("[12] F. de A. Rodríguez Díaz et al. «ES2401509 Sistema de guiado para movimiento autónomo de vehículos en entornos estructurados». 2013."),
  emptyLine()
];

// ─── DOCUMENT ASSEMBLY ───────────────────────────────────────────────────────
const allChildren = [
  ...coverPage,
  ...tocSection,
  ...sec1,
  ...sec2,
  pageBreak(),
  ...sec3,
  pageBreak(),
  ...sec4,
  pageBreak(),
  ...sec5,
  pageBreak(),
  ...sec6,
  pageBreak(),
  ...sec7,
  pageBreak(),
  ...sec8,
  pageBreak(),
  ...sec9,
  ...sec10
];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "-", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20, color: GRAY_TEXT } }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: BLUE_DARK },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: BLUE_MID },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 }
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: "2F5496" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE_MID, space: 4 } },
          children: [
            new TextRun({ text: "PROYECTO EXPAI – Pipeline de Software: Fábrica de Modelos de IA", size: 16, font: "Arial", color: "888888" }),
            new TextRun("\t"),
            new TextRun({ text: "ACCURO TECHNOLOGY S.L.", size: 16, font: "Arial", color: BLUE_MID, bold: true })
          ],
          tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.TabStopPosition.MAX }]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE_MID, space: 4 } },
          children: [
            new TextRun({ text: "Documento Técnico Confidencial – EXPAI SmartIndustry 21028", size: 16, font: "Arial", color: "888888" }),
            new TextRun("\t"),
            new TextRun({ text: "Pág. ", size: 16, font: "Arial", color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "888888" })
          ],
          tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.TabStopPosition.MAX }]
        })]
      })
    },
    children: allChildren
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:/Users/Alexis/Downloads/EXPAI_Pipeline_Fabrica_Modelos_IA.docx", buffer);
  console.log("Documento generado: EXPAI_Pipeline_Fabrica_Modelos_IA.docx");
}).catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
