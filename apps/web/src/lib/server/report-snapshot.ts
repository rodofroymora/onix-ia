import type { OrgOverview } from '@/lib/server/insights';

/** Lo que un informe necesita para verse igual después, aunque cambien los datos. */
export function toSnapshot(o: OrgOverview) {
  const pick = {
    official: o.official,
    previous: o.previous,
    officialDims: o.officialDims,
    previousDims: o.previousDims,
    targets: o.targets,
    disagreements: o.disagreements,
    questionByCode: [...o.questionByCode.entries()].filter(([code]) => o.disagreements.some((d) => d.questionCode === code)).map(([code, q]) => [code, { prompt: q.prompt }]),
    uncovered: o.uncovered,
    unknownByDim: o.unknownByDim,
    cases: o.cases,
    prioritized: o.prioritized,
    actions: o.actions,
    stages: o.stages,
    overdue: o.overdue,
    planPct: o.planPct,
    projection: o.projection,
    respondents: o.respondents.map((r) => ({ id: r.id, name: r.name, status: r.status })),
  };
  return { v: 1, takenAt: new Date().toISOString(), data: JSON.parse(JSON.stringify(pick)) as unknown };
}

export type ReportSnapshot = ReturnType<typeof toSnapshot>;

/** Reconstruye la vista del informe a partir de la foto guardada. */
export function fromSnapshot(s: ReportSnapshot): OrgOverview {
  const d = s.data as Record<string, unknown> & { questionByCode: [string, { prompt: string }][] };
  return { ...(d as object), questionByCode: new Map(d.questionByCode) } as unknown as OrgOverview;
}
