import { describe, expect, it } from 'vitest';
import {
  aggregateRespondentAnswers,
  countUnknownByDimension,
  findRespondentDisagreements,
  projectDimensions,
} from '../src/index.js';

const A = (r: string, c: string, v: number | null) => ({
  respondentId: r,
  questionCode: c,
  dimension: 'est' as const,
  value: v,
});

describe('respondentes', () => {
  it('promedia por pregunta e ignora "No sé"', () => {
    const m = aggregateRespondentAnswers(['q1', 'q2', 'q3'], [
      A('a', 'q1', 1), A('b', 'q1', 4), A('a', 'q2', null), A('b', 'q2', 3),
    ]);
    expect(m).toEqual([3, 3, 1]);
  });

  it('detecta desacuerdos de 2 niveles o más', () => {
    const d = findRespondentDisagreements([A('a', 'q1', 1), A('b', 'q1', 3), A('a', 'q2', 2), A('b', 'q2', 3)]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ questionCode: 'q1', delta: 2 });
  });

  it('cuenta "No sé" por dimensión', () => {
    expect(countUnknownByDimension([A('a', 'q1', null), A('b', 'q1', 2)]).est).toBe(1);
  });

  it('proyecta con topes y avisa si la meta no se alcanza', () => {
    const p = projectDimensions(
      [{ dimension: 'est', score: 40 }],
      [{ dimension: 'est', progress: 50, liftPoints: 20 }],
      { est: 90 },
    );
    const est = p.find((x) => x.dimension === 'est')!;
    expect(est.projected).toBe(50);
    expect(est.targetUnreachable).toBe(true);
  });
});
