/**
 * Siembra demo v2 de Grupo Altamar (hospitalidad, empresa mediana).
 * Datos ficticios para demostración. No constituye certificación.
 */
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  aggregateRespondentAnswers,
  compute,
  findGaps,
  type DimensionKey,
  type RespondentAnswer,
} from '@onix/engine';
import { maturityForRoute } from '@onix/templates';
import type { GovernTx } from './client.js';
import * as schema from './schema/index.js';

export const DEMO_SEED_VERSION = '5';

type UserRow = typeof schema.users.$inferSelect;
type QvRow = typeof schema.questionnaireVersions.$inferSelect;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** Hash determinista para variar respuestas sin aleatoriedad real. */
function jitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5 .. 0.5
}

interface Respondent {
  key: string;
  name: string;
  email: string;
  functions: string[];
  dims: DimensionKey[];
  bias: number;
}

const RESPONDENTS: Respondent[] = [
  { key: 'ana', name: 'Ana Ruiz', email: 'ana.ruiz@altamar.demo', functions: ['direccion'], dims: ['est', 'rol', 'per'], bias: 0.6 },
  { key: 'carlos', name: 'Carlos Méndez', email: 'carlos.mendez@altamar.demo', functions: ['ti', 'seguridad', 'datos'], dims: ['seg', 'dat'], bias: 0 },
  { key: 'laura', name: 'Laura Ortiz', email: 'laura.ortiz@altamar.demo', functions: ['juridico', 'riesgos'], dims: ['dat', 'rie', 'rol'], bias: -0.4 },
  { key: 'jorge', name: 'Jorge Pérez', email: 'jorge.perez@altamar.demo', functions: ['operaciones'], dims: ['est', 'rie', 'per'], bias: 0.2 },
];

/** Desacuerdos diseñados (pregunta → valor por respondente) y respuestas "No sé". */
const FORCED_INITIAL: Record<string, Record<string, number | null>> = {
  'rol-02': { ana: 4, laura: 1 },
  'est-03': { ana: 3, jorge: 1 },
  'rie-02': { laura: 1, jorge: 3 },
  'dat-04': { carlos: 3, laura: 1 },
  'per-01': { ana: 4, jorge: 2 },
  'rie-04': { jorge: null },
  'rie-05': { jorge: null },
  'per-05': { ana: null },
  'dat-06': { laura: null },
};
const FORCED_REEVAL: Record<string, Record<string, number | null>> = {
  'rol-02': { ana: 4, laura: 2 },
  'dat-04': { carlos: 3, laura: 1 },
  'per-05': { ana: null },
};

const BASE_INITIAL: Record<DimensionKey, number> = { est: 1.8, rol: 1.5, dat: 1.7, rie: 1.3, seg: 2.1, per: 1.4 };
const BASE_REEVAL: Record<DimensionKey, number> = { est: 2.0, rol: 2.2, dat: 2.1, rie: 1.8, seg: 2.3, per: 1.7 };

function buildAnswers(
  wave: string,
  base: Record<DimensionKey, number>,
  forced: Record<string, Record<string, number | null>>,
): RespondentAnswer[] {
  const out: RespondentAnswer[] = [];
  for (const q of maturityForRoute(38)) {
    for (const r of RESPONDENTS) {
      if (!r.dims.includes(q.dimension)) continue;
      const f = forced[q.code];
      let value: number | null;
      if (f && r.key in f) {
        value = f[r.key]!;
      } else {
        const raw = base[q.dimension] + r.bias + jitter(`${wave}:${q.code}:${r.key}`) * 1.2;
        value = Math.min(4, Math.max(1, Math.round(raw)));
      }
      out.push({ respondentId: r.key, questionCode: q.code, dimension: q.dimension, value });
    }
  }
  return out;
}

async function seedAssessment(
  tx: GovernTx,
  args: {
    orgId: string;
    qv: QvRow;
    owner: UserRow;
    title: string;
    kind: 'inicial' | 'reevaluacion';
    previousId: string | null;
    createdAt: Date;
    answers: RespondentAnswer[];
  },
) {
  const codes = maturityForRoute(38).map((q) => q.code);
  const m = aggregateRespondentAnswers(codes, args.answers);
  const result = compute({ m, proc: 2, aut: 2, pres: 2, datos: 2, afect: 3, area: 0, org: 'Grupo Altamar (demo)' });
  if (!result) throw new Error('compute falló en la siembra demo');

  const [assessment] = await tx
    .insert(schema.assessments)
    .values({
      organizationId: args.orgId,
      questionnaireVersionId: args.qv.id,
      title: args.title,
      status: 'completed',
      saasRoute: 38,
      globalScore: result.gs,
      globalLevel: result.gl,
      routeIndex: result.route,
      kind: args.kind,
      previousAssessmentId: args.previousId,
      createdBy: args.owner.id,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    })
    .returning();

  for (const d of result.dims) {
    await tx.insert(schema.dimensionResults).values({
      organizationId: args.orgId,
      assessmentId: assessment!.id,
      dimension: d.k,
      score: d.s,
      level: d.l,
    });
  }
  for (const g of findGaps(result.dims)) {
    await tx.insert(schema.gaps).values({
      organizationId: args.orgId,
      assessmentId: assessment!.id,
      fromDimension: g.from,
      toDimension: g.to,
      fromLevel: g.fromLevel,
      toLevel: g.toLevel,
      delta: g.delta,
    });
  }

  const qRows = await tx
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.questionnaireVersionId, args.qv.id));

  const invitationIds: Record<string, string> = {};
  for (const r of RESPONDENTS) {
    const [inv] = await tx
      .insert(schema.invitations)
      .values({
        organizationId: args.orgId,
        assessmentId: assessment!.id,
        email: r.email,
        respondentName: r.name,
        functions: r.functions,
        role: 'member',
        status: 'accepted',
        token: randomBytes(24).toString('hex'),
        expiresAt: new Date(args.createdAt.getTime() + 14 * DAY),
        completedAt: new Date(args.createdAt.getTime() + 3 * DAY),
        createdAt: args.createdAt,
      })
      .returning();
    invitationIds[r.key] = inv!.id;
  }

  for (const a of args.answers) {
    const q = qRows.find((x) => x.code === a.questionCode);
    if (!q) continue;
    await tx.insert(schema.answers).values({
      organizationId: args.orgId,
      assessmentId: assessment!.id,
      questionId: q.id,
      invitationId: invitationIds[a.respondentId]!,
      valueInt: a.value,
      valueText: a.value === null ? 'no_se' : null,
    });
  }

  return { assessment: assessment!, result };
}

export async function seedDemoV2(
  tx: GovernTx,
  org: { id: string; name: string },
  owner: UserRow,
  consultant: UserRow,
  qv: QvRow,
) {
  await tx
    .update(schema.organizations)
    .set({
      sector: 'hospitalidad',
      maturityTargets: { est: 68, rol: 68, dat: 48, rie: 52, seg: 52, per: 62 },
    })
    .where(eq(schema.organizations.id, org.id));

  await tx.insert(schema.responsibilityMaps).values({
    organizationId: org.id,
    title: 'Mapa de responsables de IA',
    roles: [
      { fn: 'direccion', role: 'Dirección', person: 'Ana Ruiz' },
      { fn: 'ti', role: 'TI', person: 'Carlos Méndez' },
      { fn: 'seguridad', role: 'Seguridad', person: 'Carlos Méndez' },
      { fn: 'datos', role: 'Datos', person: 'Carlos Méndez' },
      { fn: 'juridico', role: 'Jurídico', person: 'Laura Ortiz' },
      { fn: 'riesgos', role: 'Riesgos', person: 'Laura Ortiz' },
      { fn: 'operaciones', role: 'Operaciones', person: 'Jorge Pérez' },
      { fn: 'rh', role: 'Recursos humanos', person: '' },
    ],
  });

  await tx.insert(schema.prioritizationWeights).values({
    organizationId: org.id,
    name: 'default',
    impactoNegocio: '0.3000',
    urgenciaRegulatoria: '0.1500',
    facilidadImplementacion: '0.2000',
    dependenciaOtros: '0.1000',
    riesgoResidual: '0.1500',
    valorAprendizaje: '0.1000',
  });

  await tx.insert(schema.techProfiles).values({
    organizationId: org.id,
    name: 'Perfil tecnológico',
    stack: [
      { tool: 'Microsoft 365 Copilot', eco: 'microsoft', ring: 'Piloto', license: 'empresarial' },
      { tool: 'Azure OpenAI', eco: 'microsoft', ring: 'Adoptado', license: 'empresarial' },
      { tool: 'Power Automate', eco: 'microsoft', ring: 'Adoptado', license: 'empresarial' },
      { tool: 'Copilot Studio', eco: 'microsoft', ring: 'Evaluando', license: 'empresarial' },
      { tool: 'Amazon Bedrock', eco: 'aws', ring: 'Piloto', license: 'empresarial' },
      { tool: 'ChatGPT', eco: 'asistentes', ring: 'Adoptado', license: 'empresarial' },
      { tool: 'Claude', eco: 'asistentes', ring: 'Evaluando', license: 'empresarial' },
      { tool: 'Gemini', eco: 'asistentes', ring: 'Retirar', license: 'gratuita' },
      { tool: 'HubSpot AI', eco: 'plataformas', ring: 'Piloto', license: 'empresarial' },
      { tool: 'Databricks', eco: 'datos', ring: 'Evaluando', license: 'empresarial' },
      { tool: 'GitHub Copilot', eco: 'desarrollo', ring: 'Adoptado', license: 'empresarial' },
      { tool: 'Zapier', eco: 'automatizacion', ring: 'Retirar', license: 'personal' },
    ],
    notes: 'Herramientas declaradas por TI en la Revisión inicial.',
  });

  // Dos ciclos: Revisión inicial (hace ~5 meses) y reevaluación (este mes).
  const first = await seedAssessment(tx, {
    orgId: org.id,
    qv,
    owner,
    title: 'Revisión inicial',
    kind: 'inicial',
    previousId: null,
    createdAt: daysAgo(150),
    answers: buildAnswers('inicial', BASE_INITIAL, FORCED_INITIAL),
  });
  const second = await seedAssessment(tx, {
    orgId: org.id,
    qv,
    owner,
    title: 'Reevaluación semestral',
    kind: 'reevaluacion',
    previousId: first.assessment.id,
    createdAt: daysAgo(6),
    answers: buildAnswers('reeval', BASE_REEVAL, FORCED_REEVAL),
  });
  const current = second.assessment;

  const cases: Omit<typeof schema.aiUseCases.$inferInsert, "organizationId">[] = [
    {
      name: 'Asistente de reservaciones por WhatsApp',
      description: 'Responde dudas y crea prerreservas; un agente confirma antes de cobrar.',
      area: 'Atención a clientes', risk: 'Medio', status: 'Aprobado', inProduction: true, recommended: true,
      ownerName: 'Mariana López', technology: 'Azure OpenAI', vendor: 'Microsoft',
      usesPersonalData: true, customerFacing: true, autonomy: 'aprueba_humano',
      valueScore: 5, annualValue: 1800000, strategicObjective: 'Crecer reservas directas', strategicFit: 5,
      dataQuality: 3, effort: 2, techMaturity: 4, integration: 3, infrastructure: 5, skills: 3,
    },
    {
      name: 'Respuesta a reseñas en línea',
      description: 'Propone respuestas a reseñas de huéspedes; el gerente aprueba.',
      area: 'Marketing y contenido', risk: 'Bajo', status: 'Aprobado', inProduction: true, recommended: true,
      ownerName: 'Paola Garza', technology: 'ChatGPT Team', vendor: 'OpenAI',
      customerFacing: true, autonomy: 'aprueba_humano',
      valueScore: 3, annualValue: 250000, strategicObjective: 'Mejorar reputación en línea', strategicFit: 4,
      dataQuality: 4, effort: 1, techMaturity: 5, integration: 4, infrastructure: 5, skills: 4,
    },
    {
      name: 'Pronóstico de ocupación y tarifas',
      description: 'Modelo de demanda para ajustar tarifas por temporada y evento.',
      area: 'Finanzas y crédito', risk: 'Medio', status: 'En revisión',
      ownerName: 'Ricardo Salas', technology: 'Databricks', vendor: 'Databricks',
      autonomy: 'sugiere',
      valueScore: 5, annualValue: 3200000, strategicObjective: 'Mejorar margen por habitación', strategicFit: 5,
      dataQuality: 2, effort: 4, techMaturity: 4, integration: 2, infrastructure: 2, skills: 2,
    },
    {
      name: 'Transcripción de juntas con app gratuita',
      description: 'Uso detectado en ventas: graba juntas con clientes en una app con cuenta personal.',
      area: 'Operación interna', risk: 'Alto', status: 'Propuesto', origin: 'import',
      ownerName: 'Sin dueño', technology: 'App de transcripción (cuenta personal)', vendor: 'Desconocido',
      usesPersonalData: true, autonomy: 'autonomo',
      valueScore: 2, strategicFit: 2, dataQuality: 3, effort: 1, techMaturity: 4, integration: 5, infrastructure: 5, skills: 5,
    },
    {
      name: 'Filtro de CVs para reclutamiento',
      description: 'Ordena candidatos de recepción y camaristas por perfil.',
      area: 'Personal y reclutamiento', risk: 'Alto', status: 'En revisión',
      ownerName: 'Sin responsable de RH', technology: 'Módulo de IA del ATS', vendor: 'Proveedor ATS',
      usesPersonalData: true, decidesOnPeople: true, autonomy: 'sugiere',
      valueScore: 3, annualValue: 400000, strategicObjective: 'Reducir rotación', strategicFit: 3,
      dataQuality: 2, effort: 2, techMaturity: 3, integration: 3, infrastructure: 4, skills: 2,
    },
    {
      name: 'Copiloto para ventas corporativas',
      description: 'Resume cuentas y prepara propuestas para grupos y convenciones.',
      area: 'Marketing y contenido', risk: 'Medio', status: 'Propuesto',
      ownerName: 'Diego Ramos', technology: 'Microsoft 365 Copilot', vendor: 'Microsoft',
      usesPersonalData: true, autonomy: 'sugiere',
      valueScore: 4, annualValue: 900000, strategicObjective: 'Crecer segmento corporativo', strategicFit: 4,
      dataQuality: 3, effort: 2, techMaturity: 4, integration: 4, infrastructure: 4, skills: 3,
    },
    {
      name: 'Detección de fraude en pagos',
      description: 'Marca cargos sospechosos y bloquea la reserva hasta revisión.',
      area: 'Finanzas y crédito', risk: 'Alto', status: 'Propuesto',
      ownerName: 'Ricardo Salas', technology: 'Proveedor de pagos', vendor: 'Pasarela de pagos',
      usesPersonalData: true, decidesOnPeople: true, customerFacing: true, autonomy: 'autonomo',
      valueScore: 4, annualValue: 1100000, strategicObjective: 'Reducir contracargos', strategicFit: 4,
      dataQuality: 3, effort: 3, techMaturity: 3, integration: 2, infrastructure: 3, skills: 2,
    },
    {
      name: 'Contenido para redes sociales',
      description: 'Borradores de publicaciones y fotos editadas por el equipo de marca.',
      area: 'Marketing y contenido', risk: 'Bajo', status: 'Aprobado', inProduction: true,
      ownerName: 'Paola Garza', technology: 'ChatGPT Team', vendor: 'OpenAI',
      autonomy: 'aprueba_humano',
      valueScore: 2, annualValue: 120000, strategicObjective: 'Mejorar reputación en línea', strategicFit: 3,
      dataQuality: 4, effort: 1, techMaturity: 5, integration: 5, infrastructure: 5, skills: 4,
    },
    {
      name: 'Asistente interno de políticas y manuales',
      description: 'Contesta preguntas del personal con base en manuales internos y cita la fuente.',
      area: 'Operación interna', risk: 'Bajo', status: 'En revisión',
      ownerName: 'Jorge Pérez', technology: 'Claude vía Amazon Bedrock', vendor: 'AWS',
      autonomy: 'sugiere',
      valueScore: 3, annualValue: 350000, strategicObjective: 'Acelerar la capacitación', strategicFit: 4,
      dataQuality: 3, effort: 3, techMaturity: 4, integration: 3, infrastructure: 3, skills: 3,
    },
    {
      name: 'Evaluación automática de crédito a agencias',
      description: 'Aprobaría líneas de crédito a agencias de viaje sin revisión humana.',
      area: 'Finanzas y crédito', risk: 'Inaceptable', status: 'Descartado',
      ownerName: 'Ricardo Salas', technology: 'Por definir', vendor: 'Por definir',
      decidesOnPeople: true, autonomy: 'autonomo',
      valueScore: 3, strategicFit: 2, dataQuality: 1, effort: 4, techMaturity: 2, integration: 2, infrastructure: 2, skills: 1,
    },
  ];
  for (const c of cases) {
    await tx.insert(schema.aiUseCases).values({
      ...c,
      organizationId: org.id,
      assessmentId: current.id,
      origin: c.origin ?? 'manual',
    });
  }

  await tx.insert(schema.triageValidations).values([
    {
      organizationId: org.id,
      assessmentId: current.id,
      subject: 'Filtro de CVs para reclutamiento',
      opinions: [3, 3, 4],
      agreed: false,
      resolvedValue: 4,
    },
    {
      organizationId: org.id,
      assessmentId: current.id,
      subject: 'Asistente de reservaciones por WhatsApp',
      opinions: [2, 2],
      agreed: true,
      resolvedValue: 2,
    },
  ]);

  const [plan] = await tx
    .insert(schema.plans)
    .values({ organizationId: org.id, assessmentId: current.id, title: 'Plan de gobierno de IA' })
    .returning();

  const stageIds: Record<string, string> = {};
  const stageNames = ['Bases', 'Controles', 'Mejora continua'] as const;
  for (let i = 0; i < stageNames.length; i++) {
    const [st] = await tx
      .insert(schema.stages)
      .values({ organizationId: org.id, planId: plan!.id, name: stageNames[i]!, orderIndex: i })
      .returning();
    stageIds[stageNames[i]!] = st!.id;
  }

  type A = {
    title: string; summary: string; dim: DimensionKey; stage: (typeof stageNames)[number];
    progress: '0' | '25' | '50' | '75' | '100'; due: number; lift: number; critical?: boolean;
    fromRisk?: 'Alto' | 'Inaceptable'; evidence?: 'approved' | 'pending';
  };
  const planActions: A[] = [
    { title: 'Comité de IA y principios de uso responsable', summary: 'Acta de instalación, integrantes y principios aprobados por dirección.', dim: 'rol', stage: 'Bases', progress: '75', due: 10, lift: 10, critical: true, evidence: 'pending' },
    { title: 'Inventario de herramientas y agentes autorizados', summary: 'Lista con dueño, datos permitidos y estado de cada herramienta.', dim: 'rol', stage: 'Bases', progress: '100', due: -20, lift: 8, critical: true, evidence: 'approved' },
    { title: 'Política de uso de IA para todo el personal', summary: 'Documento corto, comunicado y con aceptación formal.', dim: 'per', stage: 'Bases', progress: '50', due: 15, lift: 9 },
    { title: 'Clasificación de datos para uso con IA', summary: 'Qué información se puede usar en qué herramienta.', dim: 'dat', stage: 'Bases', progress: '25', due: 25, lift: 10, critical: true },
    { title: 'Retirar cuentas personales y gratuitas de IA', summary: 'Migrar usos a cuentas empresariales y bloquear las personales.', dim: 'seg', stage: 'Bases', progress: '50', due: 7, lift: 8, critical: true, fromRisk: 'Alto' },
    { title: 'Evaluación de impacto para casos de riesgo alto', summary: 'Formato y revisión para CVs, fraude y transcripción.', dim: 'rie', stage: 'Controles', progress: '25', due: 45, lift: 10, critical: true, fromRisk: 'Alto' },
    { title: 'Revisión humana obligatoria en filtro de CVs', summary: 'Ningún candidato se descarta sin revisión de una persona.', dim: 'rie', stage: 'Controles', progress: '0', due: 30, lift: 7, critical: true, fromRisk: 'Alto' },
    { title: 'Cláusulas de IA con proveedores', summary: 'Uso de datos, entrenamiento y notificación de incidentes en contratos.', dim: 'dat', stage: 'Controles', progress: '0', due: 60, lift: 7 },
    { title: 'Pruebas de seguridad a agentes de cara al cliente', summary: 'Pruebas con base en OWASP para el asistente de WhatsApp.', dim: 'seg', stage: 'Controles', progress: '0', due: 75, lift: 8 },
    { title: 'Capacitación por rol en uso seguro de IA', summary: 'Sesiones cortas para recepción, ventas y finanzas.', dim: 'per', stage: 'Controles', progress: '25', due: 50, lift: 8 },
    { title: 'Métricas de valor por caso de IA', summary: 'Línea base y meta para cada caso aprobado.', dim: 'est', stage: 'Mejora continua', progress: '0', due: 120, lift: 9 },
    { title: 'Revisión trimestral del portafolio de IA', summary: 'Comité revisa valor, riesgo y avance cada trimestre.', dim: 'est', stage: 'Mejora continua', progress: '0', due: 150, lift: 7 },
  ];
  for (const a of planActions) {
    const [row] = await tx
      .insert(schema.actions)
      .values({
        organizationId: org.id,
        planId: plan!.id,
        stageId: stageIds[a.stage]!,
        title: a.title,
        summary: a.summary,
        dimension: a.dim,
        progress: a.progress,
        critical: a.critical ?? false,
        deletable: !(a.critical ?? false),
        fromRisk: a.fromRisk ?? null,
        ownerUserId: owner.id,
        dueDate: isoDate(a.due),
        liftPoints: a.lift,
      })
      .returning();
    if (a.evidence) {
      await tx.insert(schema.evidences).values({
        organizationId: org.id,
        actionId: row!.id,
        status: a.evidence,
        label: a.evidence === 'approved' ? 'Inventario firmado por dirección' : 'Acta de instalación del comité',
        url: null,
        notes: a.evidence === 'approved' ? 'Revisado por el consultor.' : 'En revisión del consultor.',
        reviewedBy: a.evidence === 'approved' ? consultant.id : null,
      });
    }
  }

  await tx.insert(schema.reports).values({
    organizationId: org.id,
    assessmentId: first.assessment.id,
    title: 'Informe de Revisión inicial',
    kind: 'evaluacion',
    payload: {
      note: 'Revisión orientativa con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador.',
      body:
        'Grupo Altamar ya usa IA en atención a clientes, marketing y finanzas, pero sin reglas comunes: nadie es responsable del uso de IA y no hay una lista de herramientas aprobadas. ' +
        'Lo más débil es riesgo y control, y personas y cultura. Recomendamos tres decisiones para los próximos 90 días: nombrar un comité de IA, retirar las cuentas personales y gratuitas, y clasificar los datos que pueden salir a proveedores externos.',
      bodySource: 'editado',
      globalScore: first.result.gs,
      globalLevel: first.result.gl,
      dims: first.result.dims.map((d) => ({ k: d.k, s: d.s, l: d.l })),
    },
    createdAt: daysAgo(140),
    updatedAt: daysAgo(140),
  });

  await tx.insert(schema.auditLogs).values({
    organizationId: org.id,
    actorUserId: consultant.id,
    action: 'seed',
    entityType: 'organization',
    entityId: org.id,
    meta: { demo: true, version: DEMO_SEED_VERSION, note: 'Grupo Altamar (demo)' },
  });
}
