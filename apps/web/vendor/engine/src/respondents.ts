import { DIMS } from './constants.js';
import { lvl } from './compute.js';
import type { DimensionKey } from './types.js';

/** Respuesta de un respondente a una pregunta: nivel 1 a 4, o null si contestó "No sé". */
export interface RespondentAnswer {
  respondentId: string;
  questionCode: string;
  dimension: DimensionKey;
  value: number | null;
}

export interface RespondentDisagreement {
  questionCode: string;
  dimension: DimensionKey;
  min: number;
  max: number;
  delta: number;
  /** Valor por respondente (null = "No sé"). */
  values: Record<string, number | null>;
}

/**
 * Agrega varias respuestas por pregunta en un solo valor 1 a 4 (promedio redondeado).
 * "No sé" no cuenta para el nivel; si nadie contestó con nivel, cuenta como Inicial (1).
 * Devuelve los valores en el orden de `codes`, listo para `compute({ m })`.
 */
export function aggregateRespondentAnswers(codes: string[], answers: RespondentAnswer[]): number[] {
  return codes.map((code) => {
    const vals = answers
      .filter((a) => a.questionCode === code && typeof a.value === 'number')
      .map((a) => a.value as number)
      .filter((v) => v >= 1 && v <= 4);
    if (vals.length === 0) return 1;
    const avg = vals.reduce((t, v) => t + v, 0) / vals.length;
    return Math.min(4, Math.max(1, Math.round(avg)));
  });
}

/**
 * Desacuerdos entre respondentes: preguntas donde dos personas difieren en
 * `minDelta` niveles o más (por defecto 2). Ordenadas de mayor a menor diferencia.
 */
export function findRespondentDisagreements(
  answers: RespondentAnswer[],
  minDelta = 2,
): RespondentDisagreement[] {
  const byCode = new Map<string, RespondentAnswer[]>();
  for (const a of answers) {
    const list = byCode.get(a.questionCode) ?? [];
    list.push(a);
    byCode.set(a.questionCode, list);
  }
  const out: RespondentDisagreement[] = [];
  for (const [code, list] of byCode) {
    const nums = list.map((a) => a.value).filter((v): v is number => typeof v === 'number');
    if (nums.length < 2) continue;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (max - min < minDelta) continue;
    const values: Record<string, number | null> = {};
    for (const a of list) values[a.respondentId] = a.value;
    out.push({ questionCode: code, dimension: list[0]!.dimension, min, max, delta: max - min, values });
  }
  return out.sort((a, b) => b.delta - a.delta || a.questionCode.localeCompare(b.questionCode));
}

/** Cuántas respuestas "No sé" hay por dimensión (puntos ciegos). */
export function countUnknownByDimension(answers: RespondentAnswer[]): Record<DimensionKey, number> {
  const out = Object.fromEntries(DIMS.map((d) => [d.k, 0])) as Record<DimensionKey, number>;
  for (const a of answers) if (a.value === null) out[a.dimension] += 1;
  return out;
}

export interface DimensionProjection {
  dimension: DimensionKey;
  current: number;
  projected: number;
  target: number | null;
  currentLevel: number;
  projectedLevel: number;
  /** Puntos que sumarían las acciones si llegaran a 100%. */
  potential: number;
  /** true si ni con todas las acciones al 100% se alcanza la meta. */
  targetUnreachable: boolean;
}

/** Tope de puntos que una dimensión puede subir en un ciclo de 12 meses (1.5 niveles de 4 ≈ 37). */
export const MAX_DIMENSION_GAIN_PER_CYCLE = 37;

/**
 * Madurez proyectada por dimensión a partir del avance de las acciones del plan.
 * Cada acción suma `liftPoints × avance` a su dimensión, con tope por ciclo y sin
 * superar 74 (Gestionado exige meses operando, lo confirma la reevaluación).
 */
export function projectDimensions(
  current: { dimension: DimensionKey; score: number }[],
  actions: { dimension: DimensionKey | null; progress: number; liftPoints: number }[],
  targets: Partial<Record<DimensionKey, number>> = {},
): DimensionProjection[] {
  return DIMS.map((d) => {
    const cur = current.find((c) => c.dimension === d.k)?.score ?? 0;
    const mine = actions.filter((a) => a.dimension === d.k);
    const gain = mine.reduce((t, a) => t + a.liftPoints * (Math.min(100, Math.max(0, a.progress)) / 100), 0);
    const potential = mine.reduce((t, a) => t + a.liftPoints, 0);
    const cap = (v: number) => Math.min(Math.min(100, cur + MAX_DIMENSION_GAIN_PER_CYCLE), Math.max(cur, v));
    let projected = Math.round(cap(cur + gain));
    if (cur < 75 && projected >= 75) projected = 74;
    const maxReach = Math.round(cap(cur + potential));
    const target = typeof targets[d.k] === 'number' ? (targets[d.k] as number) : null;
    return {
      dimension: d.k,
      current: cur,
      projected,
      target,
      currentLevel: lvl(cur) ?? 1,
      projectedLevel: lvl(projected) ?? 1,
      potential: Math.round(potential),
      targetUnreachable: target !== null && maxReach < target,
    };
  });
}
