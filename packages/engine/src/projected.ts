import {
  GESTIONADO_MIN_MONTHS,
  MAX_LEVEL_GAIN_PER_CYCLE,
  MAX_POINTS_PER_12_MONTHS,
} from './constants.js';
import { lvl } from './compute.js';
import type { ProjectedMaturityInput, ProjectedMaturityResult } from './types.js';

/**
 * Madurez proyectada con topes:
 * - máx +1 nivel por ciclo
 * - Gestionado requiere 3 meses operando
 * - máx +1.5 puntos / 12 meses
 */
export function projectMaturity(input: ProjectedMaturityInput): ProjectedMaturityResult | null {
  const {
    currentLevel,
    currentScore,
    cycleGainPoints,
    monthsOperating,
    pointsLast12Months,
  } = input;

  if (
    ![currentLevel, currentScore, cycleGainPoints, monthsOperating, pointsLast12Months].every(
      (v) => typeof v === 'number' && Number.isFinite(v),
    )
  ) {
    return null;
  }
  if (currentLevel < 1 || currentLevel > 4) return null;
  if (currentScore < 0 || currentScore > 100) return null;
  if (cycleGainPoints < 0 || monthsOperating < 0 || pointsLast12Months < 0) return null;

  const reasons: string[] = [];
  let cappedPoints = false;
  let cappedLevel = false;
  let blockedGestionado = false;

  const remainingYearBudget = Math.max(0, MAX_POINTS_PER_12_MONTHS - pointsLast12Months);
  let appliedGain = cycleGainPoints;
  if (appliedGain > remainingYearBudget) {
    appliedGain = remainingYearBudget;
    cappedPoints = true;
    reasons.push(
      `Tope de +${MAX_POINTS_PER_12_MONTHS} puntos / 12 meses: se aplican ${appliedGain} de ${cycleGainPoints}.`,
    );
  }

  let projectedScore = Math.min(100, Math.round((currentScore + appliedGain) * 10) / 10);
  let rawLevel = lvl(projectedScore) ?? currentLevel;

  // Máx +1 nivel por ciclo
  if (rawLevel > currentLevel + MAX_LEVEL_GAIN_PER_CYCLE) {
    rawLevel = currentLevel + MAX_LEVEL_GAIN_PER_CYCLE;
    cappedLevel = true;
    reasons.push(`Tope de +${MAX_LEVEL_GAIN_PER_CYCLE} nivel por ciclo.`);
  }
  if (rawLevel < currentLevel) {
    rawLevel = currentLevel;
  }

  // Gestionado (4) requiere 3 meses operando en el nivel previo / actual
  if (rawLevel >= 4 && monthsOperating < GESTIONADO_MIN_MONTHS) {
    blockedGestionado = true;
    rawLevel = Math.min(3, rawLevel);
    if (currentLevel >= 3) {
      // mantener en Definido hasta cumplir meses
      rawLevel = 3;
    }
    reasons.push(
      `Gestionado requiere ${GESTIONADO_MIN_MONTHS} meses operando (actual: ${monthsOperating}).`,
    );
    // Ajustar score para no caer visualmente en banda Gestionado si está bloqueado
    if (projectedScore >= 75) {
      projectedScore = 74.9;
    }
  }

  return {
    projectedLevel: rawLevel,
    projectedScore,
    cappedLevel,
    cappedPoints,
    blockedGestionado,
    reasons,
  };
}
