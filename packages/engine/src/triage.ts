import type { TriageInput, TriageResult } from './types.js';

/**
 * Triage: si los validadores discrepan, se toma el máximo (más conservador).
 */
export function triage(input: TriageInput): TriageResult | null {
  const { opinions } = input;
  if (!Array.isArray(opinions) || opinions.length === 0) return null;
  if (opinions.some((o) => typeof o !== 'number' || !Number.isFinite(o))) return null;

  const max = Math.max(...opinions);
  const min = Math.min(...opinions);
  const agreed = opinions.every((o) => o === opinions[0]);

  return {
    agreed,
    value: agreed ? opinions[0]! : max,
    max,
    min,
  };
}
