import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIORITIZATION_WEIGHTS,
  projectMaturity,
  resolveActionProgress,
  scorePrioritization,
} from '../src/index.js';

describe('scorePrioritization', () => {
  it('calcula score ponderado 0–100', () => {
    const r = scorePrioritization(
      {
        impactoNegocio: 5,
        urgenciaRegulatoria: 5,
        facilidadImplementacion: 5,
        dependenciaOtros: 5,
        riesgoResidual: 5,
        valorAprendizaje: 5,
      },
      DEFAULT_PRIORITIZATION_WEIGHTS,
    );
    expect(r).not.toBeNull();
    expect(r!.normalized).toBe(100);
    expect(r!.score).toBeCloseTo(5, 5);
  });

  it('pondera criterios distintos', () => {
    const highImpact = scorePrioritization({
      impactoNegocio: 5,
      urgenciaRegulatoria: 0,
      facilidadImplementacion: 0,
      dependenciaOtros: 0,
      riesgoResidual: 0,
      valorAprendizaje: 0,
    })!;
    const highEase = scorePrioritization({
      impactoNegocio: 0,
      urgenciaRegulatoria: 0,
      facilidadImplementacion: 5,
      dependenciaOtros: 0,
      riesgoResidual: 0,
      valorAprendizaje: 0,
    })!;
    expect(highImpact.normalized).toBeGreaterThan(highEase.normalized);
  });

  it('rechaza valores fuera de 0–5', () => {
    expect(
      scorePrioritization({
        impactoNegocio: 6,
        urgenciaRegulatoria: 1,
        facilidadImplementacion: 1,
        dependenciaOtros: 1,
        riesgoResidual: 1,
        valorAprendizaje: 1,
      }),
    ).toBeNull();
  });
});

describe('projectMaturity', () => {
  it('limita a +1 nivel por ciclo', () => {
    const r = projectMaturity({
      currentLevel: 1,
      currentScore: 10,
      cycleGainPoints: 80,
      monthsOperating: 12,
      pointsLast12Months: 0,
    });
    expect(r).not.toBeNull();
    // puntos anuales limitan a +1.5, nivel a +1
    expect(r!.projectedLevel).toBeLessThanOrEqual(2);
    expect(r!.cappedLevel || r!.cappedPoints).toBe(true);
  });

  it('bloquea Gestionado sin 3 meses operando', () => {
    const r = projectMaturity({
      currentLevel: 3,
      currentScore: 74,
      cycleGainPoints: 1.5,
      monthsOperating: 1,
      pointsLast12Months: 0,
    });
    expect(r).not.toBeNull();
    expect(r!.blockedGestionado).toBe(true);
    expect(r!.projectedLevel).toBeLessThanOrEqual(3);
    expect(r!.projectedScore).toBeLessThan(75);
  });

  it('permite Gestionado con 3+ meses', () => {
    const r = projectMaturity({
      currentLevel: 3,
      currentScore: 74,
      cycleGainPoints: 1.5,
      monthsOperating: 3,
      pointsLast12Months: 0,
    });
    expect(r).not.toBeNull();
    expect(r!.blockedGestionado).toBe(false);
    expect(r!.projectedScore).toBeGreaterThanOrEqual(75);
    expect(r!.projectedLevel).toBe(4);
  });

  it('respeta tope +1.5 / 12 meses', () => {
    const r = projectMaturity({
      currentLevel: 2,
      currentScore: 40,
      cycleGainPoints: 5,
      monthsOperating: 6,
      pointsLast12Months: 1,
    });
    expect(r).not.toBeNull();
    expect(r!.cappedPoints).toBe(true);
    expect(r!.projectedScore - 40).toBeCloseTo(0.5, 5);
  });
});

describe('resolveActionProgress', () => {
  it('permite 100 solo con evidencia aprobada', () => {
    expect(resolveActionProgress({ claimed: 100, evidenceStatus: 'approved' })).toEqual({
      progress: 100,
      blockedClose: false,
      reason: null,
    });
    const blocked = resolveActionProgress({ claimed: 100, evidenceStatus: 'pending' });
    expect(blocked!.progress).toBe(75);
    expect(blocked!.blockedClose).toBe(true);
  });

  it('evidencia rechazada → 75', () => {
    const r = resolveActionProgress({ claimed: 100, evidenceStatus: 'rejected' });
    expect(r!.progress).toBe(75);
    expect(r!.blockedClose).toBe(true);
  });

  it('pasos intermedios sin evidencia', () => {
    for (const p of [0, 25, 50, 75] as const) {
      const r = resolveActionProgress({ claimed: p, evidenceStatus: 'none' });
      expect(r!.progress).toBe(p);
      expect(r!.blockedClose).toBe(false);
    }
  });
});
