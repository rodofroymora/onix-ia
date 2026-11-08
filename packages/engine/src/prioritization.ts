import { DEFAULT_PRIORITIZATION_WEIGHTS } from './constants.js';
import type {
  PrioritizationCriteria,
  PrioritizationResult,
  PrioritizationWeights,
} from './types.js';

const KEYS = [
  'impactoNegocio',
  'urgenciaRegulatoria',
  'facilidadImplementacion',
  'dependenciaOtros',
  'riesgoResidual',
  'valorAprendizaje',
] as const;

function clamp01to5(v: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5;
}

export function normalizeWeights(weights: PrioritizationWeights): PrioritizationWeights | null {
  const sum = KEYS.reduce((t, k) => t + weights[k], 0);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  const out = { ...weights };
  for (const k of KEYS) {
    out[k] = weights[k] / sum;
  }
  return out;
}

/**
 * Puntuación de priorización: 6 criterios ponderados (escala 0–5 cada uno).
 * `normalized` en 0–100.
 */
export function scorePrioritization(
  criteria: PrioritizationCriteria,
  weights: PrioritizationWeights = DEFAULT_PRIORITIZATION_WEIGHTS,
): PrioritizationResult | null {
  for (const k of KEYS) {
    if (!clamp01to5(criteria[k])) return null;
    if (typeof weights[k] !== 'number' || !Number.isFinite(weights[k]) || weights[k] < 0) {
      return null;
    }
  }
  const w = normalizeWeights(weights);
  if (!w) return null;

  let score = 0;
  for (const k of KEYS) {
    score += criteria[k] * w[k];
  }
  const normalized = Math.round((score / 5) * 1000) / 10;

  return { score, normalized, weights: w, criteria };
}
