import { DIMS, levelName } from '@onix/engine';
import type { OrgOverview } from '@/lib/server/insights';

export type AssistantTask =
  | 'resumen_ejecutivo'
  | 'hallazgos'
  | 'siguientes_pasos'
  | 'preguntas_entrevista'
  | 'mensaje_invitacion'
  | 'inventario_resumen'
  | 'casos_controles'
  | 'fichas_incompletas'
  | 'explicar_ranking'
  | 'que_hacer_primero'
  | 'bloqueos_plan'
  | 'avance_comite'
  | 'agentes_atencion'
  | 'uso_no_autorizado'
  | 'lectura_telemetria'
  | 'optimizar_costo'
  | 'huecos_responsables'
  | 'correo_direccion';

export const SYSTEM = [
  'Eres el Asistente Ónix, apoyo de un consultor de gobierno de IA para empresas medianas en México.',
  'Escribe en español de México, tratando de tú, con frases cortas y concretas.',
  'Solo usa los datos que te doy; si algo falta, dilo. No inventes cifras.',
  'No digas "diagnóstico" (di "Revisión inicial") ni "certificado". ÓNIX no es organismo certificador.',
  'No uses guiones largos como puntuación. Máximo 170 palabras. Formato: una frase inicial corta y después de 3 a 4 puntos, cada uno en su línea como "- **Título corto:** explicación en una o dos frases". Sin encabezados ni tablas.',
].join(' ');

export function dimName(k: string) {
  return DIMS.find((d) => d.k === k)?.n ?? k;
}

/** Contexto compacto y citable que se le pasa al modelo. */
export function contextFrom(o: OrgOverview): { text: string; sources: string[] } {
  const lines: string[] = [];
  const sources: string[] = [];
  if (o.official) {
    lines.push(`Madurez global: ${o.official.globalScore} de 100, nivel ${levelName(o.official.globalLevel ?? 1)} (${o.official.title}).`);
    sources.push(`Evaluación: ${o.official.title}`);
    lines.push('Por dimensión: ' + o.officialDims.map((d) => `${d.name} ${d.score}`).join('; ') + '.');
  }
  if (o.previous && o.previousDims) {
    lines.push('Evaluación anterior: ' + o.previousDims.map((d) => `${d.name} ${d.score}`).join('; ') + '.');
  }
  if (o.disagreements.length) {
    const top = o.disagreements.slice(0, 4).map((g) => {
      const q = o.questionByCode.get(g.questionCode);
      return `"${q?.prompt ?? g.questionCode}" (${dimName(g.dimension)}, diferencia de ${g.delta} niveles)`;
    });
    lines.push(`Desacuerdos entre respondentes: ${top.join('; ')}.`);
    sources.push('Mapa de brechas entre respondentes');
  }
  const unknown = Object.entries(o.unknownByDim).filter(([, v]) => v > 0);
  if (unknown.length) lines.push(`Respuestas "No sé": ${unknown.map(([k, v]) => `${dimName(k)} ${v}`).join(', ')}.`);
  if (o.uncovered.length) lines.push(`Funciones sin responsable: ${o.uncovered.join(', ')}.`);
  const high = o.cases.filter((c) => c.risk === 'Alto' || c.risk === 'Inaceptable');
  lines.push(`Inventario: ${o.cases.length} casos de IA, ${high.length} de riesgo alto o inaceptable (${high.map((c) => c.name).join(', ')}).`);
  sources.push('Inventario de casos de IA');
  const top = o.prioritized.filter((p) => !p.blocked && p.score != null).slice(0, 3);
  if (top.length) lines.push(`Prioridades: ${top.map((p) => `${p.c.name} (${p.score}, ${p.quadrant})`).join('; ')}.`);
  lines.push(`Plan: ${o.planPct}% de avance promedio, ${o.actions.length} acciones, ${o.overdue.length} vencidas.`);
  sources.push('Plan por etapas');
  const behind = o.projection.filter((p) => p.targetUnreachable).map((p) => dimName(p.dimension));
  if (behind.length) lines.push(`Metas que no se alcanzan ni con todas las acciones: ${behind.join(', ')}.`);
  if (o.agents.length) {
    const noCase = o.agents.filter((x) => !x.useCaseId);
    lines.push(
      `Agentes: ${o.agents.length} registrados, ${o.agents.filter((x) => !x.managed).length} no gestionados, ${o.agents.filter((x) => !x.ownerName).length} sin dueño, ${noCase.length} sin caso en el inventario (${noCase.slice(0, 6).map((x) => `${x.name} riesgo ${x.risk}`).join('; ')}).`,
    );
    sources.push('Agent Discovery');
  }
  if (o.usage.length) {
    const last = String(o.usage.at(-1)!.period);
    const rows = o.usage.filter((u) => String(u.period) === last);
    lines.push(
      `Telemetría ${last.slice(0, 7)}: ${rows.map((u) => `${u.tool}${u.sanctioned ? '' : ' (no autorizada)'} ${u.activeUsers} usuarios, ${u.requests} solicitudes, $${u.costMxn} MXN, ${u.incidents} incidentes`).join('; ')}.`,
    );
    sources.push('Telemetría de uso');
  }
  const blocked = o.deps
    .map((d) => ({ d, f: o.actions.find((x) => x.id === d.fromActionId), t: o.actions.find((x) => x.id === d.toActionId) }))
    .filter((x) => x.f && x.t && Number(x.f.progress) < 100 && Number(x.t.progress) < 100 && x.d.weight >= 60);
  if (blocked.length) lines.push(`Dependencias abiertas: ${blocked.map((x) => `"${x.t!.title}" depende ${x.d.weight}% de "${x.f!.title}" (${x.f!.progress}%)`).join('; ')}.`);
  return { text: lines.join('\n'), sources };
}

export const PROMPTS: Record<AssistantTask, string> = {
  resumen_ejecutivo: 'Redacta un resumen ejecutivo para la dirección: dónde está la empresa, qué cambió y qué decidir ahora.',
  hallazgos: 'Resume los tres hallazgos más importantes de la evaluación y por qué importan para el negocio.',
  siguientes_pasos: 'Propón los tres siguientes pasos concretos para las próximas cuatro semanas, con quién debería encargarse.',
  preguntas_entrevista: 'Propón de 3 a 4 preguntas para la entrevista con los responsables, a partir de los desacuerdos y respuestas "No sé".',
  mensaje_invitacion: 'Redacta un mensaje breve y amable para invitar a un responsable a contestar el cuestionario (puede ir por WhatsApp o correo). Sin lista: un solo párrafo.',
  inventario_resumen: 'Resume el inventario de casos de IA: cuántos hay, dónde se concentran, qué riesgo tienen y qué está en producción.',
  casos_controles: 'Lista los casos de IA que necesitan controles antes de escalar y qué control conviene en cada uno.',
  fichas_incompletas: 'Di qué casos tienen la ficha incompleta o sin priorizar y qué dato falta para cada uno.',
  explicar_ranking: 'Explica en palabras simples por qué los primeros casos del ranking quedaron arriba y cómo influyen los pesos.',
  que_hacer_primero: 'Recomienda por cuáles casos empezar este trimestre y por qué, considerando valor, factibilidad y riesgo.',
  bloqueos_plan: 'Identifica qué acciones del plan están vencidas o bloqueadas por dependencias y qué destrabarlas primero.',
  avance_comite: 'Redacta una actualización breve del avance del plan para el comité de IA.',
  agentes_atencion: 'Di qué agentes de IA requieren atención (riesgo, sin dueño, sin caso, no gestionados) y qué hacer con cada uno.',
  uso_no_autorizado: 'Explica el uso no autorizado de IA (shadow AI) que se ve y cómo reducirlo sin frenar a la gente.',
  lectura_telemetria: 'Haz una lectura del uso de IA del último mes: tendencias, herramientas principales e incidentes.',
  optimizar_costo: 'Sugiere dónde optimizar el costo de las herramientas de IA según su uso.',
  huecos_responsables: 'Revisa el mapa de responsabilidades y di qué funciones faltan cubrir y por qué importan.',
  correo_direccion: 'Redacta un correo corto para la dirección compartiendo el informe y los tres puntos que deben decidir.',
};


/** Redacción sin modelo: el mismo contenido, armado con plantillas a partir de los datos. */
function fallbackBase(task: 'resumen_ejecutivo' | 'hallazgos' | 'siguientes_pasos', o: OrgOverview): string {
  const weakest = [...o.officialDims].sort((a, b) => a.score - b.score).slice(0, 2);
  const strongest = [...o.officialDims].sort((a, b) => b.score - a.score)[0];
  const top = o.prioritized.filter((p) => !p.blocked && p.score != null).slice(0, 2);
  const high = o.cases.filter((c) => c.risk === 'Alto');
  const g = o.official?.globalScore ?? 0;
  const prevG = o.previous?.globalScore ?? null;
  if (task === 'resumen_ejecutivo') {
    return [
      `La madurez global está en ${g} de 100 (${levelName(o.official?.globalLevel ?? 1)})${prevG != null ? `, ${g - prevG >= 0 ? 'sube' : 'baja'} ${Math.abs(g - prevG)} puntos contra la evaluación anterior` : ''}.`,
      `La fortaleza es ${strongest?.name.toLowerCase()}; lo más débil es ${weakest.map((d) => d.name.toLowerCase()).join(' y ')}.`,
      high.length ? `Hay ${high.length} casos de riesgo alto que requieren controles antes de escalar: ${high.map((c) => c.name).join(', ')}.` : '',
      top.length ? `Para generar valor pronto, conviene empujar ${top.map((p) => p.c.name).join(' y ')}.` : '',
      `El plan va en ${o.planPct}% con ${o.overdue.length} acciones vencidas.`,
    ].filter(Boolean).join(' ');
  }
  if (task === 'hallazgos') {
    const d = o.disagreements[0];
    const q = d ? o.questionByCode.get(d.questionCode) : null;
    return [
      `1. ${weakest[0]?.name} es la dimensión más baja (${weakest[0]?.score}); concentra el mayor riesgo de que la IA crezca sin control.`,
      d ? `2. Los respondentes no coinciden en "${q?.prompt ?? d.questionCode}" (diferencia de ${d.delta} niveles): conviene aclararlo en la entrevista.` : '2. Los respondentes coinciden en lo general; no hay desacuerdos fuertes.',
      o.uncovered.length ? `3. ${o.uncovered.join(', ')} no tiene responsable: es un punto ciego para decidir y responder incidentes.` : `3. ${high.length} casos de riesgo alto siguen sin todos sus controles.`,
    ].join('\n');
  }
  const crit = o.actions.filter((a) => a.critical && Number(a.progress) < 100).slice(0, 3);
  return crit.length
    ? crit.map((a, i) => `${i + 1}. ${a.title} (va en ${a.progress}%).`).join('\n')
    : 'Las acciones críticas están cerradas. Siguiente paso: programar la reevaluación para confirmar el avance.';
}


/** Redacta con el modelo si está configurado; si no (o si falla), con plantillas a partir de los datos. */
export async function writeWithAssistant(
  task: AssistantTask,
  o: OrgOverview,
  orgName: string,
): Promise<{ text: string; source: 'llm' | 'datos'; sources: string[]; llmError?: string }> {
  const { providerFromEnv } = await import('@onix/agent');
  const ctx = contextFrom(o);
  const provider = providerFromEnv();
  if (provider) {
    try {
      const res = await provider.complete({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Datos de ${orgName}:\n${ctx.text}\n\nTarea: ${PROMPTS[task]}` },
        ],
      });
      if (res.content) return { text: res.content, source: 'llm', sources: ctx.sources };
    } catch (err) {
      console.error('[asistente] fallo del proveedor, uso redacción con datos', err);
      return { text: fallback(task, o), source: 'datos', sources: ctx.sources, llmError: llmHint(err) };
    }
  }
  return { text: fallback(task, o), source: 'datos', sources: ctx.sources };
}

/** Mensaje corto y sin secretos de por qué falló el modelo. */
export function llmHint(err: unknown): string {
  const e = err as { hint?: string; message?: string };
  return e?.hint ?? 'El modelo no respondió.';
}

/** Redacción sin modelo para todas las funciones (plantillas con los datos). */
export function fallback(task: AssistantTask, o: OrgOverview): string {
  const RANK: Record<string, number> = { Bajo: 1, Medio: 2, Alto: 3, Inaceptable: 4 };
  const high = o.cases.filter((c) => c.risk === 'Alto' || c.risk === 'Inaceptable');
  const prod = o.cases.filter((c) => c.inProduction);
  const ready = o.prioritized.filter((p) => !p.blocked && p.score != null);
  const today = new Date().toISOString().slice(0, 10);
  switch (task) {
    case 'resumen_ejecutivo':
    case 'hallazgos':
    case 'siguientes_pasos':
      return fallbackBase(task, o);
    case 'preguntas_entrevista': {
      const qs = o.disagreements.slice(0, 3).map((d) => `- **${dimName(d.dimension)}:** ¿Por qué unas áreas ven "${o.questionByCode.get(d.questionCode)?.prompt ?? d.questionCode}" distinto que otras?`);
      const unknown = Object.entries(o.unknownByDim).filter(([, v]) => v > 0).map(([k]) => `- **${dimName(k)}:** ¿Quién tendría la respuesta que hoy nadie conoce?`);
      return ['Preguntas sugeridas para la entrevista:', ...qs, ...unknown].slice(0, 5).join('\n');
    }
    case 'mensaje_invitacion':
      return `Hola. ${o.org?.name ?? 'La empresa'} está haciendo su Revisión inicial de IA con ÓNIX y tu área es clave. Son unas preguntas agrupadas en seis temas; te toman unos 15 minutos y puedes pausar y seguir después. Te comparto tu enlace personal. ¡Gracias!`;
    case 'inventario_resumen': {
      const areas = [...new Set(o.cases.map((c) => c.area).filter(Boolean))];
      return [
        `Hay ${o.cases.length} casos de IA registrados, ${prod.length} en producción.`,
        `- **Riesgo:** ${high.length} de riesgo alto o inaceptable (${high.map((c) => c.name).join(', ') || 'ninguno'}).`,
        `- **Áreas:** se concentran en ${areas.slice(0, 3).join(', ') || 'sin área definida'}.`,
        `- **Sin dueño:** ${o.cases.filter((c) => !c.ownerName || /sin/i.test(c.ownerName)).length} casos.`,
      ].join('\n');
    }
    case 'casos_controles':
      return high.length
        ? ['Estos casos necesitan controles antes de escalar:', ...high.map((c) => `- **${c.name}:** ${c.decidesOnPeople ? 'revisión humana obligatoria de cada decisión' : c.usesPersonalData ? 'aviso de privacidad y límites de datos' : c.customerFacing ? 'pruebas de seguridad y monitoreo de respuestas' : 'evaluación de impacto y dueño claro'}.`)].join('\n')
        : 'No hay casos de riesgo alto: mantén la revisión trimestral del portafolio.';
    case 'fichas_incompletas': {
      const inc = o.prioritized.filter((p) => p.missing.length);
      return inc.length
        ? ['Fichas que necesitan datos para priorizarse:', ...inc.map((p) => `- **${p.c.name}:** falta ${p.missing.join(', ')}.`)].join('\n')
        : 'Todas las fichas tienen lo necesario para priorizar.';
    }
    case 'explicar_ranking':
      return ['El puntaje combina seis criterios con los pesos que definió la organización.', ...ready.slice(0, 3).map((p, i) => `- **${i + 1}. ${p.c.name}:** ${p.score} puntos, ${p.quadrant?.toLowerCase()}; riesgo ${p.c.risk.toLowerCase()}.`)].join('\n');
    case 'que_hacer_primero': {
      const top = ready.filter((p) => p.quadrant === 'Apuestas prioritarias').slice(0, 2);
      const quick = ready.filter((p) => p.quadrant === 'Ganancias rápidas').slice(0, 1);
      return ['Para este trimestre:', ...top.map((p) => `- **${p.c.name}:** mucho valor y factible; arráncalo ya.`), ...quick.map((p) => `- **${p.c.name}:** ganancia rápida para mostrar resultados pronto.`), ...high.filter((c) => c.risk === 'Alto').slice(0, 1).map((c) => `- **${c.name}:** antes de escalar, cierra sus controles.`)].join('\n');
    }
    case 'bloqueos_plan': {
      const blockedBy = o.deps
        .filter((d) => d.weight >= 60)
        .map((d) => ({ d, from: o.actions.find((a) => a.id === d.fromActionId), to: o.actions.find((a) => a.id === d.toActionId) }))
        .filter((x) => x.from && x.to && Number(x.from.progress) < 100 && Number(x.to.progress) < 100)
        .slice(0, 3);
      const late = o.actions.filter((a) => a.dueDate && a.dueDate < today && Number(a.progress) < 100);
      return [
        late.length ? `Hay ${late.length} acciones vencidas.` : 'No hay acciones vencidas.',
        ...blockedBy.map((x) => `- **${x.to!.title}:** depende en ${x.d.weight}% de "${x.from!.title}", que va en ${x.from!.progress}%.`),
      ].join('\n');
    }
    case 'avance_comite':
      return [`El plan va en ${o.planPct}% con ${o.actions.filter((a) => Number(a.progress) === 100).length} de ${o.actions.length} acciones cerradas con evidencia.`, ...o.actions.filter((a) => a.critical && Number(a.progress) < 100).slice(0, 3).map((a) => `- **${a.title}:** va en ${a.progress}%.`)].join('\n');
    case 'agentes_atencion': {
      const caseRisk = new Map(o.cases.map((c) => [c.id, c.risk]));
      const list = o.agents.filter((a) => !a.useCaseId || !a.ownerName || !a.managed || (a.useCaseId && (RANK[a.risk] ?? 0) > (RANK[caseRisk.get(a.useCaseId) ?? ''] ?? 0))).slice(0, 5);
      return [`De ${o.agents.length} agentes, estos requieren atención:`, ...list.map((a) => `- **${a.name}:** ${!a.useCaseId ? 'sin caso en el inventario' : !a.ownerName ? 'sin dueño' : !a.managed ? 'no gestionado por TI' : 'corre con más riesgo que su caso'}; riesgo ${a.risk.toLowerCase()}.`)].join('\n');
    }
    case 'uso_no_autorizado': {
      const last = o.usage.filter((u) => String(u.period) === String(o.usage.at(-1)?.period ?? ''));
      const shadow = last.filter((u) => !u.sanctioned);
      return [shadow.length ? `Este mes hay ${shadow.length} herramientas no autorizadas en uso.` : 'Este mes no se ve uso no autorizado.', ...shadow.map((u) => `- **${u.tool}:** ${u.activeUsers} usuarios y ${u.requests.toLocaleString('es-MX')} solicitudes; ofrece una alternativa autorizada.`), '- **Política:** comunica qué herramientas sí están aprobadas y para qué datos.'].join('\n');
    }
    case 'lectura_telemetria':
    case 'optimizar_costo': {
      const periods = [...new Set(o.usage.map((u) => String(u.period)))].sort();
      const last = o.usage.filter((u) => String(u.period) === periods.at(-1));
      const top = [...last].sort((a, b) => b.costMxn - a.costMxn).slice(0, 3);
      const total = last.reduce((t, u) => t + u.costMxn, 0);
      return task === 'lectura_telemetria'
        ? [`El último mes hubo ${last.reduce((t, u) => t + u.requests, 0).toLocaleString('es-MX')} solicitudes y ${last.reduce((t, u) => t + u.incidents, 0)} incidentes.`, ...top.map((u) => `- **${u.tool}:** ${u.activeUsers} usuarios, $${u.costMxn.toLocaleString('es-MX')} MXN.`)].join('\n')
        : [`El costo del mes es $${total.toLocaleString('es-MX')} MXN.`, ...top.map((u) => `- **${u.tool}:** $${Math.round((u.costMxn / Math.max(1, u.activeUsers))).toLocaleString('es-MX')} MXN por usuario; revisa licencias sin uso.`)].join('\n');
    }
    case 'huecos_responsables':
      return o.uncovered.length
        ? ['Funciones sin responsable:', ...o.uncovered.map((f) => `- **${f}:** sin dueño, nadie decide ni responde por la IA en esa área.`)].join('\n')
        : 'Todas las funciones tienen responsable.';
    case 'correo_direccion':
      return `Hola. Te comparto el informe de gobierno de IA. La madurez está en ${o.official?.globalScore ?? 'sin dato'} de 100 y el plan va en ${o.planPct}%. Necesitamos tu decisión en tres puntos: los casos a priorizar, los controles de los casos de riesgo alto y los responsables pendientes. Quedo atento.`;
  }
}
