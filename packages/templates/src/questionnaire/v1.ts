/** Cuestionario Govern v1 — 38 preguntas de madurez + factores de caso. */

export type DimKey = 'est' | 'rol' | 'dat' | 'rie' | 'seg' | 'per';

export interface MaturityQuestion {
  code: string;
  dimension: DimKey;
  prompt: string;
  options: [string, string, string, string];
}

export interface CaseQuestion {
  code: string;
  kind: 'text' | 'choice';
  prompt: string;
  options?: string[];
  hint?: string;
}

const L4 = (
  a: string,
  b: string,
  c: string,
  d: string,
): [string, string, string, string] => [a, b, c, d];

/** Distribución 38: est7, rol6, dat7, rie6, seg6, per6 */
export const MATURITY_QUESTIONS_V1: MaturityQuestion[] = [
  // est (7)
  {
    code: 'est-01',
    dimension: 'est',
    prompt: '¿El uso de IA está ligado a objetivos del negocio?',
    options: L4(
      'Cada quien la usa por su cuenta',
      'Algunos usos tienen un objetivo claro',
      'La mayoría tiene objetivo y responsable',
      'Se priorizan y se miden contra resultados del negocio',
    ),
  },
  {
    code: 'est-02',
    dimension: 'est',
    prompt: '¿Miden el beneficio de lo que hacen con IA?',
    options: L4(
      'No lo medimos',
      'Tenemos impresiones, sin números',
      'Medimos algunos casos con una línea base',
      'Cada caso tiene meta y se revisa periódicamente',
    ),
  },
  {
    code: 'est-03',
    dimension: 'est',
    prompt: '¿Existe un portafolio priorizado de casos de uso de IA?',
    options: L4(
      'No hay portafolio',
      'Hay una lista informal',
      'Hay portafolio con criterios básicos',
      'Hay portafolio con valor, riesgo y capacidad',
    ),
  },
  {
    code: 'est-04',
    dimension: 'est',
    prompt: '¿Se compara el costo de la IA contra el beneficio esperado?',
    options: L4(
      'No se compara',
      'Se estima de palabra',
      'Hay un cálculo simple por caso',
      'Hay modelo de costos y beneficios revisado',
    ),
  },
  {
    code: 'est-05',
    dimension: 'est',
    prompt: '¿La dirección revisa avances de IA con cierta periodicidad?',
    options: L4(
      'No se revisa',
      'Solo cuando hay un incidente',
      'Hay revisiones ocasionales',
      'Hay un ritmo fijo de revisión con decisiones',
    ),
  },
  {
    code: 'est-06',
    dimension: 'est',
    prompt: '¿Los casos de IA tienen dueño de resultado de negocio?',
    options: L4(
      'Nadie es dueño',
      'Dueño informal',
      'Dueño asignado en algunos casos',
      'Dueño formal en todos los casos activos',
    ),
  },
  {
    code: 'est-07',
    dimension: 'est',
    prompt: '¿Se retiran o pausan usos de IA que no aportan valor?',
    options: L4(
      'Nunca se revisa eso',
      'A veces se habla de hacerlo',
      'Se ha pausado alguno',
      'Hay criterio y proceso para retirar usos',
    ),
  },
  // rol (6)
  {
    code: 'rol-01',
    dimension: 'rol',
    prompt: '¿Hay alguien responsable del uso de IA en la empresa?',
    options: L4(
      'No hay un responsable',
      'Alguien lo ve de forma informal',
      'Hay una persona asignada',
      'Hay un rol formal con objetivos y presupuesto',
    ),
  },
  {
    code: 'rol-02',
    dimension: 'rol',
    prompt: '¿Tienen una lista de las herramientas de IA que se usan y de quién las aprobó?',
    options: L4(
      'No sabemos bien cuáles se usan',
      'Conocemos las principales',
      'Hay una lista, pero no se actualiza',
      'Hay un inventario actualizado con dueño por herramienta',
    ),
  },
  {
    code: 'rol-03',
    dimension: 'rol',
    prompt: '¿Quién puede autorizar un nuevo uso de IA?',
    options: L4(
      'Cualquiera, sin trámite',
      'Depende del área',
      'Hay un flujo básico de autorización',
      'Hay matriz de autorización según riesgo',
    ),
  },
  {
    code: 'rol-04',
    dimension: 'rol',
    prompt: '¿Existen principios escritos de uso responsable de IA?',
    options: L4(
      'No',
      'Se están redactando',
      'Existen, poco conocidos',
      'Existen, se comunican y se aplican',
    ),
  },
  {
    code: 'rol-05',
    dimension: 'rol',
    prompt: '¿Las decisiones clave de IA quedan registradas?',
    options: L4(
      'No se registran',
      'Algunas en correos',
      'Hay un registro parcial',
      'Hay registro con trazabilidad',
    ),
  },
  {
    code: 'rol-06',
    dimension: 'rol',
    prompt: '¿Hay escalamiento claro cuando un uso de IA genera duda o conflicto?',
    options: L4(
      'No hay a quién escalar',
      'Se improvisan',
      'Hay un canal conocido',
      'Hay procedimiento y tiempos de respuesta',
    ),
  },
  // dat (7)
  {
    code: 'dat-01',
    dimension: 'dat',
    prompt: '¿Tu equipo sabe qué información puede compartir con herramientas de IA?',
    options: L4(
      'No hay reglas',
      'Hay recomendaciones de palabra',
      'Hay reglas escritas',
      'Hay reglas escritas y controles técnicos',
    ),
  },
  {
    code: 'dat-02',
    dimension: 'dat',
    prompt:
      '¿Tienen identificada su información sensible y un aviso de privacidad que contemple el uso de IA?',
    options: L4(
      'No',
      'Sabemos cuál es, sin documentar',
      'Está identificada; el aviso no menciona IA',
      'Protegida, con reglas de acceso y aviso actualizado',
    ),
  },
  {
    code: 'dat-03',
    dimension: 'dat',
    prompt: '¿Clasifican la información (pública, interna, confidencial, sensible)?',
    options: L4(
      'No hay clasificación',
      'Clasificación informal',
      'Clasificación documentada parcial',
      'Clasificación aplicada y revisada',
    ),
  },
  {
    code: 'dat-04',
    dimension: 'dat',
    prompt: '¿Controlan qué datos salen a proveedores o modelos externos?',
    options: L4(
      'No se controla',
      'Se confía en el proveedor',
      'Hay lista de datos permitidos',
      'Hay controles técnicos y contractuales',
    ),
  },
  {
    code: 'dat-05',
    dimension: 'dat',
    prompt: '¿Atienden derechos ARCO u obligaciones equivalentes cuando aplica IA?',
    options: L4(
      'No está considerado',
      'Se responde caso por caso',
      'Hay proceso básico',
      'Hay proceso con plazos y responsables',
    ),
  },
  {
    code: 'dat-06',
    dimension: 'dat',
    prompt: '¿Minimizan datos personales en prompts y entrenamientos?',
    options: L4(
      'No se piensa en eso',
      'Se pide de palabra',
      'Hay guía escrita',
      'Hay guía y revisión técnica',
    ),
  },
  {
    code: 'dat-07',
    dimension: 'dat',
    prompt: '¿Registran el origen de los datos usados por cada caso de IA?',
    options: L4(
      'No',
      'Solo en casos grandes',
      'Registro parcial',
      'Inventario de fuentes por caso',
    ),
  },
  // rie (6)
  {
    code: 'rie-01',
    dimension: 'rie',
    prompt: '¿Revisan riesgos antes de adoptar una herramienta o lanzar un agente?',
    options: L4(
      'No, se adopta y ya',
      'Solo en compras grandes',
      'Hay una revisión básica',
      'Hay checklist y aprobación según el nivel de riesgo',
    ),
  },
  {
    code: 'rie-02',
    dimension: 'rie',
    prompt: 'Si una IA le da una respuesta equivocada a un cliente, ¿qué pasa?',
    options: L4(
      'Probablemente no nos enteraríamos',
      'Se corrige cuando alguien lo nota',
      'Hay revisión humana en casos clave',
      'Hay proceso de revisión, registro y mejora',
    ),
  },
  {
    code: 'rie-03',
    dimension: 'rie',
    prompt: '¿Clasifican el impacto de cada caso (bajo, medio, alto, inaceptable)?',
    options: L4(
      'No se clasifica',
      'Se discute sin criterio',
      'Hay criterios básicos',
      'Hay matriz de impacto aplicada',
    ),
  },
  {
    code: 'rie-04',
    dimension: 'rie',
    prompt: '¿Tienen forma de pausar un uso de IA si algo falla?',
    options: L4(
      'No',
      'Se puede pedir, sin procedimiento',
      'Hay un contacto para pausar',
      'Hay kill-switch o procedimiento inmediato',
    ),
  },
  {
    code: 'rie-05',
    dimension: 'rie',
    prompt: '¿Evalúan sesgos o trato injusto cuando la IA afecta a personas?',
    options: L4(
      'No se evalúa',
      'Solo si hay queja',
      'Se revisa en algunos casos',
      'Hay pruebas y criterios definidos',
    ),
  },
  {
    code: 'rie-06',
    dimension: 'rie',
    prompt: '¿Documentan supuestos y límites de cada modelo o agente?',
    options: L4(
      'No',
      'Notas sueltas',
      'Documento básico por caso',
      'Ficha de límites revisada periódicamente',
    ),
  },
  // seg (6)
  {
    code: 'seg-01',
    dimension: 'seg',
    prompt: '¿Las herramientas de IA se usan con cuentas empresariales y accesos controlados?',
    options: L4(
      'Cuentas personales, sin control',
      'Mezcla de personales y empresariales',
      'Principalmente empresariales',
      'Todas empresariales, con accesos y registro de actividad',
    ),
  },
  {
    code: 'seg-02',
    dimension: 'seg',
    prompt: '¿Lo que construyen con IA se prueba antes de lanzarse y se monitorea después?',
    options: L4(
      'No se prueba ni se monitorea',
      'Pruebas manuales de vez en cuando',
      'Pruebas antes de lanzar, sin monitoreo',
      'Pruebas automatizadas y monitoreo en operación',
    ),
  },
  {
    code: 'seg-03',
    dimension: 'seg',
    prompt: '¿Prueban ataques como inyección de prompts o fugas de información?',
    options: L4(
      'No',
      'Se conoce el riesgo, sin pruebas',
      'Pruebas ocasionales',
      'Pruebas sistemáticas antes de operar',
    ),
  },
  {
    code: 'seg-04',
    dimension: 'seg',
    prompt: '¿Gestionan secretos y claves de API de forma segura?',
    options: L4(
      'Se comparten en chats o archivos',
      'Cada quien las guarda',
      'Hay un gestor básico',
      'Hay vault y rotación de claves',
    ),
  },
  {
    code: 'seg-05',
    dimension: 'seg',
    prompt: '¿Monitorean costos, errores e incidentes de los servicios de IA?',
    options: L4(
      'No',
      'Solo la factura',
      'Tablero básico',
      'Alertas y responsables de respuesta',
    ),
  },
  {
    code: 'seg-06',
    dimension: 'seg',
    prompt: '¿Tienen control de versiones o trazabilidad de prompts y agentes?',
    options: L4(
      'No',
      'Copias locales',
      'Repositorio parcial',
      'Versionado con cambios revisados',
    ),
  },
  // per (6)
  {
    code: 'per-01',
    dimension: 'per',
    prompt: '¿Existe una política de uso aceptable de IA?',
    options: L4(
      'No',
      'Se está hablando de hacerla',
      'Existe, pero pocos la conocen',
      'Existe, se comunica y se acepta formalmente',
    ),
  },
  {
    code: 'per-02',
    dimension: 'per',
    prompt: '¿Tu equipo ha recibido capacitación sobre uso responsable de IA?',
    options: L4(
      'Todavía no',
      'Cada quien aprende por su cuenta',
      'Hubo una sesión general',
      'Capacitación por rol que se actualiza',
    ),
  },
  {
    code: 'per-03',
    dimension: 'per',
    prompt: '¿El personal sabe reportar un mal uso o un incidente con IA?',
    options: L4(
      'No sabe a quién acudir',
      'Pregunta a su jefe',
      'Hay un canal comunicado',
      'Hay canal, tiempos y seguimiento',
    ),
  },
  {
    code: 'per-04',
    dimension: 'per',
    prompt: '¿Se reconoce y se desalienta el uso sombra (shadow AI)?',
    options: L4(
      'Ni se habla del tema',
      'Se menciona sin acciones',
      'Hay campaña de concientización',
      'Hay política, canales y alternativas autorizadas',
    ),
  },
  {
    code: 'per-05',
    dimension: 'per',
    prompt: '¿Incluyen el uso de IA en onboarding de personal nuevo?',
    options: L4(
      'No',
      'A veces se menciona',
      'Hay material básico',
      'Forma parte del onboarding formal',
    ),
  },
  {
    code: 'per-06',
    dimension: 'per',
    prompt: '¿La cultura permite cuestionar resultados de la IA sin miedo?',
    options: L4(
      'Se asume que la IA tiene razón',
      'Depende de la persona',
      'Se invita a revisar',
      'Hay práctica explícita de revisión crítica',
    ),
  },
];

export const CASE_QUESTIONS_V1: CaseQuestion[] = [
  {
    code: 'case-name',
    kind: 'text',
    prompt: 'Piensa en tu caso de uso de IA más importante. ¿Cómo lo describirías?',
    hint: 'Por ejemplo: asistente de WhatsApp para cotizaciones.',
  },
  {
    code: 'case-proc',
    kind: 'choice',
    prompt: '¿Qué tanto cambia la forma de trabajar?',
    options: [
      'Ayuda en una tarea; el proceso sigue igual',
      'Se ajustan algunos pasos para aprovecharla',
      'Se eliminan o cambian pasos y entregas',
      'El proceso, los roles o el servicio se rediseñan',
    ],
  },
  {
    code: 'case-aut',
    kind: 'choice',
    prompt: '¿Quién decide, la persona o la IA?',
    options: [
      'La IA sugiere; la persona decide y ejecuta',
      'La revisión humana se vuelve superficial',
      'La IA prepara acciones; la persona aprueba antes',
      'La IA decide y actúa; la persona atiende excepciones',
    ],
  },
  {
    code: 'case-pres',
    kind: 'choice',
    prompt: '¿Se usa cuando alguien la abre o trabaja sola?',
    options: [
      'Se activa cuando alguien la usa',
      'Se usa a diario dentro de una aplicación',
      'Reacciona a eventos u horarios y recuerda contexto',
      'Monitorea y actúa de forma continua',
    ],
  },
  {
    code: 'case-datos',
    kind: 'choice',
    prompt: '¿Qué tipo de información usa?',
    options: [
      'Pública o interna no confidencial',
      'Confidencial del negocio',
      'Datos personales, financieros u otros datos sensibles',
    ],
  },
  {
    code: 'case-afect',
    kind: 'choice',
    prompt: '¿A quién afectan sus resultados?',
    options: ['Solo a empleados, uso interno', 'A proveedores o socios', 'A clientes o al público'],
  },
  {
    code: 'case-area',
    kind: 'choice',
    prompt: '¿En qué área se usa principalmente?',
    options: [
      'Atención a clientes',
      'Marketing y contenido',
      'Personal y reclutamiento',
      'Finanzas y crédito',
      'Operación interna',
      'Otra área',
    ],
  },
];

export const QUESTIONNAIRE_V1 = {
  version: 'v1',
  label: 'Cuestionario Govern v1',
  maturityCount: 38,
  routes: {
    rapida: 15,
    estandar: 27,
    completa: 38,
  },
  note: 'Revisión inicial orientativa. No constituye certificación ni dictamen legal.',
  maturity: MATURITY_QUESTIONS_V1,
  caseFactors: CASE_QUESTIONS_V1,
};

/** Subconjuntos por ruta SaaS (primeras N por dimensión según distribución del motor). */
export function maturityForRoute(count: 15 | 27 | 38): MaturityQuestion[] {
  if (count === 38) return MATURITY_QUESTIONS_V1;
  const perDim: Record<DimKey, number> =
    count === 15
      ? { est: 3, rol: 2, dat: 3, rie: 2, seg: 3, per: 2 }
      : { est: 5, rol: 4, dat: 5, rie: 4, seg: 5, per: 4 };
  const out: MaturityQuestion[] = [];
  const dims: DimKey[] = ['est', 'rol', 'dat', 'rie', 'seg', 'per'];
  for (const d of dims) {
    const qs = MATURITY_QUESTIONS_V1.filter((q) => q.dimension === d);
    out.push(...qs.slice(0, perDim[d]));
  }
  return out;
}
