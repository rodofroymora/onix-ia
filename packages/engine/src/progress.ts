import { ACTION_PROGRESS_STEPS } from './constants.js';
import type {
  ActionProgress,
  ActionProgressInput,
  ActionProgressResult,
} from './types.js';

export function isValidProgress(v: number): v is ActionProgress {
  return (ACTION_PROGRESS_STEPS as readonly number[]).includes(v);
}

/**
 * Progreso de acción: 0 / 25 / 50 / 75 / 100.
 * No se puede cerrar en 100 sin evidencia aprobada.
 * Evidencia rechazada → 75.
 */
export function resolveActionProgress(input: ActionProgressInput): ActionProgressResult | null {
  const { claimed, evidenceStatus } = input;
  if (!isValidProgress(claimed)) return null;
  if (!['none', 'pending', 'approved', 'rejected'].includes(evidenceStatus)) return null;

  if (evidenceStatus === 'rejected') {
    return {
      progress: 75,
      blockedClose: true,
      reason: 'Evidencia rechazada: el progreso queda en 75 hasta nueva evidencia aprobada.',
    };
  }

  if (claimed === 100 && evidenceStatus !== 'approved') {
    return {
      progress: 75,
      blockedClose: true,
      reason: 'No se puede cerrar al 100 sin evidencia aprobada.',
    };
  }

  return {
    progress: claimed,
    blockedClose: false,
    reason: null,
  };
}
