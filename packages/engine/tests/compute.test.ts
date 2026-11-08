import { describe, expect, it } from 'vitest';
import {
  SAMPLE,
  buildPlanActions,
  canMarkProduction,
  canRecommendUseCase,
  compute,
  criticalBasesControls,
  entradasValidas,
  levelName,
  lvl,
  nextService,
  routeName,
  tierRecomendada,
} from '../src/index.js';

describe('lvl', () => {
  it('mapea umbrales de nivel', () => {
    expect(lvl(0)).toBe(1);
    expect(lvl(24)).toBe(1);
    expect(lvl(25)).toBe(2);
    expect(lvl(49)).toBe(2);
    expect(lvl(50)).toBe(3);
    expect(lvl(74)).toBe(3);
    expect(lvl(75)).toBe(4);
    expect(lvl(100)).toBe(4);
    expect(lvl(Number.NaN)).toBeNull();
  });
});

describe('compute (legacy 12)', () => {
  it('valida entradas SAMPLE', () => {
    expect(entradasValidas(SAMPLE)).toBe(true);
  });

  it('reproduce resultado orientativo del SAMPLE original', () => {
    const r = compute(SAMPLE);
    expect(r).not.toBeNull();
    expect(r!.dims).toHaveLength(6);
    expect(r!.maturityCount).toBe(12);
    expect(r!.saasRoute).toBeNull();
    expect(r!.gs).toBeGreaterThanOrEqual(0);
    expect(r!.gs).toBeLessThanOrEqual(100);
    expect(r!.gl).toBeGreaterThanOrEqual(1);
    expect(r!.gl).toBeLessThanOrEqual(4);
    expect(r!.route).toBeGreaterThanOrEqual(0);
    expect(r!.route).toBeLessThanOrEqual(2);
    expect(levelName(r!.gl)).toMatch(/Inicial|exploración|Definido|Gestionado/);
    expect(routeName(r!.route)).toMatch(/Rápida|Estándar|Completa/);
  });

  it('aplica tope cuando gl > minL + 1', () => {
    // Dimensiones muy desiguales: unas en 4, una en 1
    const m = [4, 4, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4];
    const r = compute({
      m,
      proc: 1,
      aut: 1,
      pres: 1,
      datos: 1,
      afect: 1,
      area: 4,
    });
    expect(r).not.toBeNull();
    expect(r!.minL).toBe(1);
    expect(r!.capped).toBe(true);
    expect(r!.gl).toBeLessThanOrEqual(r!.minL + 1);
  });

  it('rechaza madurez inválida', () => {
    expect(compute({ ...SAMPLE, m: [1, 2, 3] })).toBeNull();
    expect(compute({ ...SAMPLE, m: SAMPLE.m.map(() => 0) })).toBeNull();
    expect(compute({ ...SAMPLE, aut: 0 })).toBeNull();
  });

  it('nextService y tier', () => {
    const r = compute(SAMPLE)!;
    const svc = nextService(r);
    expect(svc === 'Ruta IA' || svc === 'Revisión de riesgos de IA').toBe(true);
    expect([1, 2]).toContain(tierRecomendada(r));
  });
});

describe('compute (SaaS 15/27/38)', () => {
  function fill(n: number, v = 2): number[] {
    return Array.from({ length: n }, () => v);
  }

  it('acepta 15, 27 y 38', () => {
    for (const n of [15, 27, 38] as const) {
      const r = compute({
        m: fill(n, 2),
        proc: 2,
        aut: 2,
        pres: 2,
        datos: 2,
        afect: 2,
        area: 0,
      });
      expect(r, `count ${n}`).not.toBeNull();
      expect(r!.maturityCount).toBe(n);
      expect(r!.saasRoute).toBe(n);
      expect(r!.dims).toHaveLength(6);
    }
  });

  it('promedia por dimensión con distribución desigual', () => {
    // 15: est3,rol2,dat3,rie2,seg3,per2 — poner est en 4 y el resto en 1
    const m = [
      4, 4, 4, // est
      1, 1, // rol
      1, 1, 1, // dat
      1, 1, // rie
      1, 1, 1, // seg
      1, 1, // per
    ];
    const r = compute({ m, proc: 1, aut: 1, pres: 1, datos: 1, afect: 1, area: 4 });
    expect(r).not.toBeNull();
    expect(r!.dims[0]!.k).toBe('est');
    expect(r!.dims[0]!.s).toBe(100);
    expect(r!.dims[0]!.l).toBe(4);
    expect(r!.dims[1]!.s).toBe(0);
  });
});

describe('riesgo inaceptable y controles críticos', () => {
  it('nunca recomienda ni marca producción si es Inaceptable', () => {
    expect(canRecommendUseCase('Inaceptable')).toBe(false);
    expect(canMarkProduction('Inaceptable')).toBe(false);
    expect(canRecommendUseCase('Alto')).toBe(true);
  });

  it('controles Alto/Inaceptable entran a Bases como críticos no eliminables', () => {
    const ctrls = criticalBasesControls(['Bajo', 'Alto', 'Inaceptable', 'Medio']);
    expect(ctrls).toHaveLength(2);
    expect(ctrls.every((c) => c.stage === 'Bases')).toBe(true);
    expect(ctrls.every((c) => c.critical && !c.deletable)).toBe(true);
  });

  it('buildPlanActions antepone controles críticos', () => {
    const r = compute(SAMPLE)!;
    const plan = buildPlanActions({
      compute: r,
      caseName: SAMPLE.name,
      controlRisks: ['Alto'],
    });
    expect(plan[0]!.critical).toBe(true);
    expect(plan[0]!.deletable).toBe(false);
    expect(plan[0]!.stage).toBe('Bases');
  });
});
