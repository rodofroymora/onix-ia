/** Guía de uso de Ónix Govern: la usa el Asistente para contestar "¿cómo hago…?". */
export interface HelpEntry {
  k: string;
  title: string;
  href: string;
  keywords: string[];
  answer: string;
}

export const HELP: HelpEntry[] = [
  {
    k: 'ruta',
    title: 'Cómo funciona la Ruta IA',
    href: '/',
    keywords: ['empezar', 'inicio', 'ruta', 'pasos', 'como funciona', 'que hago primero', 'por donde empiezo'],
    answer:
      'La Ruta IA tiene cuatro pasos que se ven arriba de cada pantalla:\n- **Evaluación:** los responsables contestan y obtienes la madurez por dimensión.\n- **Inventario:** registras cada caso de IA con su dueño, riesgo y valor.\n- **Priorización:** el sistema ordena los casos con los pesos que define tu organización.\n- **Plan:** acciones por etapa que se cierran solo con evidencia.',
  },
  {
    k: 'evaluacion',
    title: 'Lanzar la evaluación e invitar',
    href: '/evaluacion',
    keywords: ['evaluacion', 'lanzar', 'invitar', 'invitacion', 'invitar responsable', 'cuestionario', 'respondente', 'correo', 'whatsapp', 'enlace', 'contestar'],
    answer:
      'En Evaluación:\n- **Lanzar:** elige la ruta de preguntas (15, 27 o 38) y lanza la evaluación.\n- **Invitar:** escribe nombre, correo y las funciones que cubre; solo verá las preguntas de esas áreas. Puedes mandar el enlace por correo, WhatsApp o copiarlo.\n- **Contestar ahora:** abre el cuestionario para ti mismo, sin correo.\n- **Publicar:** cuando todos contestan, usa "Guardar y publicar resultados".',
  },
  {
    k: 'resultados',
    title: 'Leer los resultados',
    href: '/evaluacion?tab=resultados',
    keywords: ['resultados', 'madurez', 'radar', 'brechas', 'desacuerdos', 'no se', 'puntos ciegos', 'nivel'],
    answer:
      'En Resultados y brechas ves la madurez global y por dimensión (0 a 100).\n- **Mapa de respuestas:** muestra a cada persona; el punto marca diferencias de 2 niveles o más.\n- **Puntos ciegos:** funciones sin responsable y respuestas "No sé".\n- **Comparativo:** aparece cuando ya hay una reevaluación.',
  },
  {
    k: 'reevaluacion',
    title: 'Reevaluación y recordatorio',
    href: '/evaluacion',
    keywords: ['reevaluacion', 'reevaluar', 'recordatorio', 'meses', 'calendario', 'cada cuanto'],
    answer:
      'La reevaluación se lanza desde Evaluación con el mismo cuestionario para comparar. En "Próxima reevaluación" eliges cada cuántos meses (3 a 24) y puedes agregarla a tu calendario; un mes antes aparece en tus pendientes.',
  },
  {
    k: 'inventario',
    title: 'Registrar un caso de IA',
    href: '/inventario?caso=nuevo',
    keywords: ['caso', 'inventario', 'registrar', 'nuevo caso', 'ficha', 'excel', 'importar', 'plantilla', 'clasificacion', 'tipo de ia'],
    answer:
      'En Inventario usa "Nuevo caso":\n- **Asistente:** cuéntalo con tus palabras y llena la ficha por ti.\n- **Listas estándar:** tipo de IA, valor, datos, despliegue y usuarios se eligen de un menú para comparar igual entre áreas.\n- **Excel:** descarga la plantilla (trae una hoja con las listas) e importa varios casos a la vez.',
  },
  {
    k: 'riesgo',
    title: 'Riesgo y validaciones',
    href: '/inventario?tab=validaciones',
    keywords: ['riesgo', 'triaje', 'validar', 'validacion', 'inaceptable', 'alto', 'aprobar'],
    answer:
      'El triaje sugiere el riesgo según los atributos (datos personales, decisiones sobre personas, cara al cliente, autonomía). En la pestaña Validaciones cada validador da su nivel; si no coinciden, gana el más alto. Un caso inaceptable nunca puede quedar aprobado ni en producción.',
  },
  {
    k: 'priorizacion',
    title: 'Priorizar casos',
    href: '/priorizacion',
    keywords: ['priorizar', 'priorizacion', 'ranking', 'pesos', 'orbita', 'criterios', 'puntaje'],
    answer:
      'En Priorización:\n- **Órbita:** entre más cerca del centro, más prioridad; el sector dice si es apuesta prioritaria, proyecto estratégico, ganancia rápida o algo para pausar.\n- **Pesos:** el botón "Pesos de los criterios" ajusta qué valora tu organización.\n- **Mapa de calor:** muestra cada criterio de 0 a 5 por caso.',
  },
  {
    k: 'plan',
    title: 'Plan, evidencia y dependencias',
    href: '/plan',
    keywords: ['plan', 'accion', 'acciones', 'evidencia', 'avance', 'dependencia', 'linaje', 'etapas', 'vencida'],
    answer:
      'En Plan:\n- **Etapas:** toca una acción para ver con líneas de qué depende y a qué impacta, con su porcentaje.\n- **Avance:** el 100% solo se confirma cuando el consultor aprueba la evidencia.\n- **Dependencias:** se agregan desde el panel de cada acción; el sistema evita círculos.\n- **Madurez proyectada:** muestra si el plan alcanza las metas.',
  },
  {
    k: 'reportes',
    title: 'Generar reportes',
    href: '/reportes',
    keywords: ['reporte', 'informe', 'pdf', 'imprimir', 'direccion', 'comite'],
    answer:
      'En Reportes eliges: Informe de evaluación, Resumen para dirección o Avance del plan. Las cifras salen de la plataforma, el resumen lo redacta el asistente y tú lo editas; "Imprimir o guardar PDF" lo deja listo para compartir.',
  },
  {
    k: 'agentes',
    title: 'Agent Discovery',
    href: '/agentes',
    keywords: ['agente', 'agentes', 'discovery', 'mapa', 'copilot', 'shadow', 'sin dueño', 'registrar agente', 'conexiones', 'conectar', 'integracion', 'microsoft', 'aws', 'detectados'],
    answer:
      'Agent Discovery muestra los agentes en producción, incluidos los casos del inventario que aún no tienen agente.\n- **Pregúntale:** el buscador responde en lenguaje natural.\n- **Mapa:** burbujas por tecnología o red de agentes y datos.\n- **Conexiones:** escoge una integración (Microsoft 365, AWS y más), llena sus parámetros y Ónix revisa cada día con permisos de solo lectura.\n- **Detectados:** lo que encuentran las conexiones; regístralo, vincúlalo o ignóralo.\n- **Sin caso:** desde la ficha del agente usa "Crear caso desde este agente".',
  },
  {
    k: 'telemetria',
    title: 'Telemetría de uso',
    href: '/telemetria',
    keywords: ['telemetria', 'uso', 'costo', 'solicitudes', 'api', 'clave', 'token', 'no autorizado'],
    answer:
      'En Telemetría ves solicitudes, usuarios, costo e incidentes por herramienta. Puedes capturar un mes a mano o generar una clave para que tus sistemas manden los datos a /api/telemetria.',
  },
  {
    k: 'organizacion',
    title: 'Responsables y usuarios',
    href: '/organizacion',
    keywords: ['responsable', 'responsables', 'organizacion', 'usuarios', 'roles', 'mapa de responsabilidades', 'funciones'],
    answer:
      'En Organización asignas una persona a cada una de las 8 funciones (dirección, TI, seguridad, datos, jurídico, riesgos, operaciones y RH) y ves quién tiene acceso. Las funciones sin responsable aparecen como punto ciego.',
  },
  {
    k: 'atajos',
    title: 'Atajos',
    href: '/',
    keywords: ['buscar', 'atajo', 'teclado', 'cmd', 'pendientes', 'tema', 'oscuro', 'claro'],
    answer:
      '- **⌘K:** buscar cualquier caso, acción o agente.\n- **⌘J:** abrir el Asistente.\n- **Bandeja:** el ícono de arriba muestra tus pendientes.\n- **Tema:** el botón junto al buscador cambia entre claro, oscuro y el del sistema.',
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'a', 'que', 'como', 'mi', 'mis', 'se', 'por', 'para', 'con', 'lo']);
const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w);
const words = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));

/** Mejor entrada de la guía para una pregunta (sin modelo); compara raíces para tolerar conjugaciones. */
export function matchHelp(question: string): HelpEntry | null {
  const q = words(question).map(stem);
  let best: { e: HelpEntry; s: number } | null = null;
  for (const e of HELP) {
    let s = 0;
    for (const k of e.keywords) {
      const kw = words(k).map(stem);
      if (kw.length && kw.every((w) => q.some((t) => t === w || (w.length >= 4 && t.startsWith(w))))) s += kw.length + 1;
    }
    if (words(e.title).map(stem).every((w) => q.includes(w))) s += 3;
    if (s > 0 && (!best || s > best.s)) best = { e, s };
  }
  return best?.e ?? null;
}

export function helpAsText(): string {
  return HELP.map((e) => `## ${e.title} (${e.href})\n${e.answer}`).join('\n\n');
}
