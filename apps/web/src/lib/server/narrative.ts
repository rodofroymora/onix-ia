import { DIMS, levelName } from '@onix/engine';
import type { OrgOverview } from '@/lib/server/insights';

export type AssistantTask = 'resumen_ejecutivo' | 'hallazgos' | 'siguientes_pasos';

export const SYSTEM = [
  'Eres el Asistente Ónix, apoyo de un consultor de gobierno de IA para empresas medianas en México.',
  'Escribe en español de México, tratando de tú, con frases cortas y concretas.',
  'Solo usa los datos que te doy; si algo falta, dilo. No inventes cifras.',
  'No digas "diagnóstico" (di "Revisión inicial") ni "certificado". ÓNIX no es organismo certificador.',
  'No uses guiones largos como puntuación. Máximo 170 palabras. Sin encabezados ni tablas: párrafos breves o una lista corta.',
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
  return { text: lines.join('\n'), sources };
}

export const PROMPTS: Record<AssistantTask, string> = {
  resumen_ejecutivo: 'Redacta un resumen ejecutivo para la dirección: dónde está la empresa, qué cambió y qué decidir ahora.',
  hallazgos: 'Resume los tres hallazgos más importantes de la evaluación y por qué importan para el negocio.',
  siguientes_pasos: 'Propón los tres siguientes pasos concretos para las próximas cuatro semanas, con quién debería encargarse.',
};

/** Redacción sin modelo: el mismo contenido, armado con plantillas a partir de los datos. */
export function fallback(task: AssistantTask, o: OrgOverview): string {
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
