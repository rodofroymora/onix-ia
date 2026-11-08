import { describe, expect, it } from 'vitest';
import { DIMS, findGaps, triage } from '../src/index.js';
import type { DimensionScore } from '../src/index.js';

function dim(i: number, l: number, s = l * 25): DimensionScore {
  const D = DIMS[i]!;
  return {
    k: D.k,
    n: D.n,
    capa: D.capa,
    labelLines: [...D.l],
    s,
    l,
    i,
  };
}

describe('findGaps', () => {
  it('detecta diferencia de 2+ niveles', () => {
    const dims = [
      dim(0, 1),
      dim(1, 3),
      dim(2, 2),
      dim(3, 4),
      dim(4, 2),
      dim(5, 1),
    ];
    const gaps = findGaps(dims);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => g.delta >= 2)).toBe(true);
    // est(1) vs rol(3) = 2
    expect(gaps.some((g) => g.from === 'est' && g.to === 'rol' && g.delta === 2)).toBe(true);
  });

  it('no reporta gaps con delta 1', () => {
    const dims = [dim(0, 1), dim(1, 2), dim(2, 1), dim(3, 2), dim(4, 1), dim(5, 2)];
    expect(findGaps(dims)).toHaveLength(0);
  });
});

describe('triage', () => {
  it('acuerda cuando todos coinciden', () => {
    const r = triage({ opinions: [2, 2, 2] });
    expect(r).toEqual({ agreed: true, value: 2, max: 2, min: 2 });
  });

  it('toma el máximo cuando discrepan', () => {
    const r = triage({ opinions: [1, 3, 2] });
    expect(r).toEqual({ agreed: false, value: 3, max: 3, min: 1 });
  });

  it('rechaza vacío o no numérico', () => {
    expect(triage({ opinions: [] })).toBeNull();
    expect(triage({ opinions: [1, Number.NaN] })).toBeNull();
  });
});
