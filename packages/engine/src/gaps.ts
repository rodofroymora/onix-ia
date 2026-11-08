import type { DimensionScore, Gap } from './types.js';

/**
 * Brechas: diferencia de 2+ niveles entre dimensiones.
 */
export function findGaps(dims: DimensionScore[], minDelta = 2): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 0; i < dims.length; i++) {
    for (let j = i + 1; j < dims.length; j++) {
      const a = dims[i]!;
      const b = dims[j]!;
      const delta = Math.abs(a.l - b.l);
      if (delta >= minDelta) {
        const [from, to] = a.l < b.l ? [a, b] : [b, a];
        gaps.push({
          from: from.k,
          to: to.k,
          fromLevel: from.l,
          toLevel: to.l,
          delta,
        });
      }
    }
  }
  return gaps.sort((x, y) => y.delta - x.delta || x.from.localeCompare(y.from));
}
