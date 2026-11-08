import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  actions,
  aiUseCases,
  answers,
  assessments,
  dimensionResults,
  evidences,
  invitations,
  organizations,
  plans,
  prioritizationWeights,
  questions,
  responsibilityMaps,
  stages,
  techProfiles,
} from '@onix/db';
import {
  DIMS,
  countUnknownByDimension,
  findRespondentDisagreements,
  lvl,
  normalizeWeights,
  projectDimensions,
  scorePrioritization,
  type DimensionKey,
  type RespondentAnswer,
} from '@onix/engine';
import { FUNCTIONS, functionName } from '@onix/templates';
import { getDb, withOrg } from '@/lib/db';

export type CaseRow = typeof aiUseCases.$inferSelect;
export type ActionRow = typeof actions.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;

export const CRITERIA = [
  { k: 'impactoNegocio', n: 'Valor de negocio', hint: 'Valor estimado del caso (1 a 5)' },
  { k: 'urgenciaRegulatoria', n: 'Alineación estratégica', hint: 'Qué tanto empuja un objetivo del negocio' },
  { k: 'facilidadImplementacion', n: 'Factibilidad técnica', hint: 'Tecnología, integración, infraestructura y equipo' },
  { k: 'dependenciaOtros', n: 'Madurez de datos', hint: 'Disponibilidad y calidad de los datos' },
  { k: 'riesgoResidual', n: 'Riesgo controlable', hint: 'Más alto mientras menor sea el riesgo' },
  { k: 'valorAprendizaje', n: 'Esfuerzo bajo', hint: 'Más alto mientras menor sea el esfuerzo' },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]['k'];

const RISK_SCORE: Record<string, number> = { Bajo: 5, Medio: 3.5, Alto: 2, Inaceptable: 0 };

/** Factibilidad técnica 1 a 5 a partir de sus cuatro atributos (CU-08). */
export function feasibility(c: CaseRow): number | null {
  const parts = [c.techMaturity, c.integration, c.infrastructure, c.skills].filter((v): v is number => typeof v === 'number');
  if (parts.length < 4) return null;
  return parts.reduce((t, v) => t + v, 0) / 4;
}

/** Atributos que faltan para poder priorizar el caso. */
export function missingForPriority(c: CaseRow): string[] {
  const miss: string[] = [];
  if (c.valueScore == null) miss.push('valor');
  if (c.strategicFit == null) miss.push('alineación');
  if (c.dataQuality == null) miss.push('datos');
  if (c.effort == null) miss.push('esfuerzo');
  if (feasibility(c) == null) miss.push('factibilidad');
  return miss;
}

export function caseCriteria(c: CaseRow) {
  return {
    impactoNegocio: c.valueScore ?? 0,
    urgenciaRegulatoria: c.strategicFit ?? 0,
    facilidadImplementacion: feasibility(c) ?? 0,
    dependenciaOtros: c.dataQuality ?? 0,
    riesgoResidual: RISK_SCORE[c.risk] ?? 2,
    valorAprendizaje: c.effort != null ? 6 - c.effort : 0,
  };
}

export type Quadrant = 'Apuestas prioritarias' | 'Proyectos estratégicos' | 'Ganancias rápidas' | 'Revisar o pausar';

export interface PrioritizedCase {
  c: CaseRow;
  score: number | null;
  valueAxis: number;
  feasibilityAxis: number;
  quadrant: Quadrant | null;
  missing: string[];
  blocked: boolean;
}

export function prioritizeCases(cases: CaseRow[], w: Record<CriterionKey, number>): PrioritizedCase[] {
  const weights = normalizeWeights(w) ?? w;
  return cases
    .map((c) => {
      const missing = missingForPriority(c);
      const blocked = c.risk === 'Inaceptable' || c.status === 'Descartado';
      const crit = caseCriteria(c);
      const res = missing.length === 0 ? scorePrioritization(crit, weights) : null;
      // Eje de valor: valor de negocio y alineación. Eje de factibilidad: técnica, datos y esfuerzo.
      const valueAxis = (((c.valueScore ?? 0) * 0.6 + (c.strategicFit ?? 0) * 0.4) / 5) * 100;
      const feasibilityAxis =
        (((feasibility(c) ?? 0) * 0.5 + (c.dataQuality ?? 0) * 0.25 + (c.effort != null ? 6 - c.effort : 0) * 0.25) / 5) * 100;
      const quadrant: Quadrant | null =
        missing.length > 0
          ? null
          : valueAxis >= 50 && feasibilityAxis >= 50
            ? 'Apuestas prioritarias'
            : valueAxis >= 50
              ? 'Proyectos estratégicos'
              : feasibilityAxis >= 50
                ? 'Ganancias rápidas'
                : 'Revisar o pausar';
      return {
        c,
        score: res ? Math.round(res.normalized) : null,
        valueAxis,
        feasibilityAxis,
        quadrant,
        missing,
        blocked,
      };
    })
    .sort((a, b) => Number(a.blocked) - Number(b.blocked) || (b.score ?? -1) - (a.score ?? -1));
}

export function actionProgress(a: ActionRow): number {
  return Number(a.progress) || 0;
}

/** Todo lo que necesitan los tableros (CU-04, CU-10, CU-12, CU-13) en una sola lectura. */
export async function loadOrgOverview(organizationId: string) {
  const { db } = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);

  return withOrg(db, organizationId, async (tx) => {
    const allAssessments = await tx
      .select()
      .from(assessments)
      .where(eq(assessments.organizationId, organizationId))
      .orderBy(desc(assessments.createdAt));
    const completed = allAssessments.filter((a) => a.status === 'completed');
    const current = allAssessments[0] ?? null;
    const official = completed[0] ?? null;
    const previous = completed[1] ?? null;

    const dimRows = completed.length
      ? await tx
          .select()
          .from(dimensionResults)
          .where(inArray(dimensionResults.assessmentId, completed.slice(0, 2).map((a) => a.id)))
      : [];
    const dimsOf = (id: string | undefined) =>
      DIMS.map((d) => {
        const r = dimRows.find((x) => x.assessmentId === id && x.dimension === d.k);
        return { dimension: d.k, name: d.n, capa: d.capa, lines: d.l, score: r?.score ?? 0, level: r?.level ?? 1 };
      });
    const officialDims = dimsOf(official?.id);
    const previousDims = previous ? dimsOf(previous.id) : null;

    // Respuestas por respondente de la evaluación en curso (o la oficial si ya se publicó)
    const focus = current ?? official;
    const invs = focus
      ? await tx.select().from(invitations).where(eq(invitations.assessmentId, focus.id)).orderBy(invitations.createdAt)
      : [];
    const ans = focus ? await tx.select().from(answers).where(eq(answers.assessmentId, focus.id)) : [];
    const qRows = focus
      ? await tx.select().from(questions).where(eq(questions.questionnaireVersionId, focus.questionnaireVersionId))
      : [];
    const flat: RespondentAnswer[] = [];
    for (const a of ans) {
      const q = qRows.find((x) => x.id === a.questionId);
      if (!q || q.kind !== 'maturity' || !q.dimension) continue;
      flat.push({
        respondentId: a.invitationId ?? 'consultor',
        questionCode: q.code,
        dimension: q.dimension as DimensionKey,
        value: a.valueText === 'no_se' ? null : a.valueInt,
      });
    }
    const disagreements = findRespondentDisagreements(flat);
    const unknownByDim = countUnknownByDimension(flat);
    const respondents = invs.map((i) => ({
      id: i.id,
      name: i.respondentName ?? i.email,
      email: i.email,
      functions: (Array.isArray(i.functions) ? (i.functions as string[]) : []).map(functionName),
      status: i.status,
      completedAt: i.completedAt,
      token: i.token,
      answered: flat.filter((a) => a.respondentId === i.id).length,
    }));
    const questionByCode = new Map(qRows.map((q) => [q.code, q]));

    const [map] = await tx.select().from(responsibilityMaps).where(eq(responsibilityMaps.organizationId, organizationId)).limit(1);
    const roles = (Array.isArray(map?.roles) ? map!.roles : []) as { fn?: string; role: string; person: string }[];
    const uncovered = FUNCTIONS.filter((f) => {
      const r = roles.find((x) => x.fn === f.k || x.role === f.n);
      return !r || !r.person || /pendiente/i.test(r.person);
    }).map((f) => f.n);

    const cases = await tx.select().from(aiUseCases).where(eq(aiUseCases.organizationId, organizationId)).orderBy(desc(aiUseCases.updatedAt));
    const [weightsRow] = await tx.select().from(prioritizationWeights).where(eq(prioritizationWeights.organizationId, organizationId)).limit(1);
    const weights = Object.fromEntries(
      CRITERIA.map((cr) => [cr.k, weightsRow ? Number(weightsRow[cr.k]) : 1 / 6]),
    ) as Record<CriterionKey, number>;

    const [plan] = await tx.select().from(plans).where(eq(plans.organizationId, organizationId)).orderBy(desc(plans.createdAt)).limit(1);
    const stageRows = plan ? await tx.select().from(stages).where(eq(stages.planId, plan.id)).orderBy(stages.orderIndex) : [];
    const actionRows = plan ? await tx.select().from(actions).where(eq(actions.planId, plan.id)) : [];
    const evidenceRows = actionRows.length
      ? await tx.select().from(evidences).where(and(eq(evidences.organizationId, organizationId), inArray(evidences.actionId, actionRows.map((a) => a.id))))
      : [];

    const [tech] = await tx.select().from(techProfiles).where(eq(techProfiles.organizationId, organizationId)).limit(1);

    const targets = (org?.maturityTargets ?? {}) as Partial<Record<DimensionKey, number>>;
    const projection = projectDimensions(
      officialDims.map((d) => ({ dimension: d.dimension, score: d.score })),
      actionRows.map((a) => ({ dimension: a.dimension as DimensionKey | null, progress: actionProgress(a), liftPoints: a.liftPoints })),
      targets,
    );

    const planPct = actionRows.length
      ? Math.round(actionRows.reduce((t, a) => t + actionProgress(a), 0) / actionRows.length)
      : 0;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = actionRows.filter((a) => a.dueDate && a.dueDate < today && actionProgress(a) < 100);

    const capas = ['Gobierno', 'Riesgo', 'Seguridad'].map((capa) => {
      const ds = officialDims.filter((d) => d.capa === capa);
      const s = ds.length ? Math.round(ds.reduce((t, d) => t + d.score, 0) / ds.length) : 0;
      return { capa, score: s, level: lvl(s) ?? 1 };
    });

    return {
      org: org ?? null,
      current,
      official,
      previous,
      allAssessments,
      officialDims,
      previousDims,
      capas,
      respondents,
      answers: flat,
      questionByCode,
      disagreements,
      unknownByDim,
      uncovered,
      responsibility: roles,
      cases,
      weights,
      prioritized: prioritizeCases(cases, weights),
      plan: plan ?? null,
      stages: stageRows,
      actions: actionRows,
      evidences: evidenceRows,
      tech: tech ?? null,
      targets,
      projection,
      planPct,
      overdue,
    };
  });
}

export type OrgOverview = Awaited<ReturnType<typeof loadOrgOverview>>;

const REGULATED = ['salud', 'financiero', 'seguros', 'finanzas'];

/** Triaje automático (CU-07): nivel sugerido y quién debe validarlo. */
export function suggestRisk(c: CaseRow, sector?: string | null) {
  let pts = 0;
  const why: string[] = [];
  if (c.usesPersonalData) {
    pts += 1;
    why.push('usa datos personales');
  }
  if (c.decidesOnPeople) {
    pts += 2;
    why.push('decide o recomienda sobre personas');
  }
  if (c.customerFacing) {
    pts += 1;
    why.push('es de cara al cliente');
  }
  if (c.autonomy === 'autonomo') {
    pts += 2;
    why.push('actúa solo');
  } else if (c.autonomy === 'aprueba_humano') {
    why.push('una persona aprueba');
  }
  if (sector && REGULATED.includes(sector.toLowerCase())) {
    pts += 1;
    why.push('sector regulado');
  }
  const level =
    c.decidesOnPeople && c.autonomy === 'autonomo'
      ? 'Inaceptable'
      : pts >= 4
        ? 'Alto'
        : pts >= 2
          ? 'Medio'
          : 'Bajo';
  const validators =
    level === 'Bajo'
      ? ['Dueño del caso']
      : level === 'Medio'
        ? ['Dueño del caso', 'TI']
        : level === 'Alto'
          ? ['TI', 'Seguridad', 'Jurídico']
          : ['TI', 'Seguridad', 'Jurídico', 'Dirección'];
  return { level: level as CaseRow['risk'], why, validators };
}

/** Atributos llenos de la ficha (de 13 clave). */
export function completeness(c: CaseRow): { filled: number; total: number } {
  const keys: (keyof CaseRow)[] = [
    'description', 'area', 'ownerName', 'technology', 'vendor', 'valueScore', 'strategicObjective',
    'strategicFit', 'dataQuality', 'effort', 'techMaturity', 'integration', 'infrastructure',
  ];
  const filled = keys.filter((k) => c[k] !== null && c[k] !== undefined && c[k] !== '').length;
  return { filled, total: keys.length };
}
