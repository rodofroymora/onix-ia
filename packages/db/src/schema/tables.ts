import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import {
  actionProgressEnum,
  assessmentStatusEnum,
  dimensionKeyEnum,
  evidenceStatusEnum,
  extendedRiskEnum,
  invitationStatusEnum,
  membershipRoleEnum,
  stageNameEnum,
} from './enums.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sector: text('sector'),
  country: text('country').notNull().default('MX'),
  /** Metas de madurez por dimensión (0 a 100). */
  maturityTargets: jsonb('maturity_targets').notNull().default({}),
  /** Cada cuántos meses toca reevaluar (recordatorio). */
  reevaluationMonths: integer('reevaluation_months').notNull().default(6),
  /** sha256 de la clave para enviar telemetría por API. */
  ingestKeyHash: text('ingest_key_hash'),
  ...timestamps,
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  locale: text('locale').notNull().default('es-MX'),
  ...timestamps,
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull().default('member'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('memberships_org_user_uidx').on(t.organizationId, t.userId),
    index('memberships_org_idx').on(t.organizationId),
  ],
);

export const responsibilityMaps = pgTable('responsibility_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  roles: jsonb('roles').notNull().default([]),
  ...timestamps,
});

export const questionnaireVersions = pgTable(
  'questionnaire_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    version: text('version').notNull(),
    label: text('label').notNull(),
    maturityCount: integer('maturity_count').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('questionnaire_versions_version_uidx').on(t.version)],
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    questionnaireVersionId: uuid('questionnaire_version_id')
      .notNull()
      .references(() => questionnaireVersions.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    dimension: dimensionKeyEnum('dimension'),
    kind: text('kind').notNull(), // maturity | case
    prompt: text('prompt').notNull(),
    options: jsonb('options'),
    orderIndex: integer('order_index').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('questions_version_code_uidx').on(t.questionnaireVersionId, t.code),
    index('questions_version_idx').on(t.questionnaireVersionId),
  ],
);

export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    questionnaireVersionId: uuid('questionnaire_version_id')
      .notNull()
      .references(() => questionnaireVersions.id),
    title: text('title').notNull(),
    status: assessmentStatusEnum('status').notNull().default('draft'),
    saasRoute: integer('saas_route'),
    globalScore: integer('global_score'),
    globalLevel: integer('global_level'),
    routeIndex: integer('route_index'),
    /** inicial | reevaluacion */
    kind: text('kind').notNull().default('inicial'),
    previousAssessmentId: uuid('previous_assessment_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('assessments_org_idx').on(t.organizationId)],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id').references(() => assessments.id, {
      onDelete: 'cascade',
    }),
    email: text('email').notNull(),
    role: membershipRoleEnum('role').notNull().default('member'),
    status: invitationStatusEnum('status').notNull().default('pending'),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    respondentName: text('respondent_name'),
    /** Funciones del mapa de responsables que cubre (dirección, ti, seguridad, ...). */
    functions: jsonb('functions').notNull().default([]),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('invitations_org_idx').on(t.organizationId)],
);

export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    invitationId: uuid('invitation_id').references(() => invitations.id, { onDelete: 'cascade' }),
    valueInt: integer('value_int'),
    valueText: text('value_text'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('answers_assessment_question_invitation_uidx').on(t.assessmentId, t.questionId, t.invitationId),
    index('answers_org_idx').on(t.organizationId),
  ],
);

export const dimensionResults = pgTable(
  'dimension_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    dimension: dimensionKeyEnum('dimension').notNull(),
    score: integer('score').notNull(),
    level: integer('level').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('dimension_results_assessment_dim_uidx').on(t.assessmentId, t.dimension),
  ],
);

export const gaps = pgTable('gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  fromDimension: dimensionKeyEnum('from_dimension').notNull(),
  toDimension: dimensionKeyEnum('to_dimension').notNull(),
  fromLevel: integer('from_level').notNull(),
  toLevel: integer('to_level').notNull(),
  delta: integer('delta').notNull(),
  ...timestamps,
});

export const techProfiles = pgTable('tech_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  stack: jsonb('stack').notNull().default([]),
  notes: text('notes'),
  ...timestamps,
});

export const aiUseCases = pgTable('ai_use_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id').references(() => assessments.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description'),
  risk: extendedRiskEnum('risk').notNull().default('Medio'),
  recommended: boolean('recommended').notNull().default(false),
  inProduction: boolean('in_production').notNull().default(false),
  area: text('area'),
  /** manual | discovery | import */
  origin: text('origin').notNull().default('manual'),
  /** Propuesto | En revisión | Aprobado | Descartado */
  status: text('status').notNull().default('Propuesto'),
  ownerName: text('owner_name'),
  technology: text('technology'),
  vendor: text('vendor'),
  usesPersonalData: boolean('uses_personal_data').notNull().default(false),
  decidesOnPeople: boolean('decides_on_people').notNull().default(false),
  customerFacing: boolean('customer_facing').notNull().default(false),
  /** sugiere | aprueba_humano | autonomo */
  autonomy: text('autonomy').notNull().default('sugiere'),
  /** Escalas 1 a 5 para priorización y factibilidad. */
  valueScore: integer('value_score'),
  annualValue: integer('annual_value'),
  strategicObjective: text('strategic_objective'),
  strategicFit: integer('strategic_fit'),
  dataQuality: integer('data_quality'),
  effort: integer('effort'),
  techMaturity: integer('tech_maturity'),
  integration: integer('integration'),
  infrastructure: integer('infrastructure'),
  skills: integer('skills'),
  /** Listas estándar (ver @onix/templates catalogs). */
  aiType: text('ai_type'),
  valueType: text('value_type'),
  dataClassification: text('data_classification'),
  deployment: text('deployment'),
  userScope: text('user_scope'),
  ...timestamps,
});

export const triageValidations = pgTable('triage_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  opinions: jsonb('opinions').notNull().default([]),
  agreed: boolean('agreed').notNull(),
  resolvedValue: integer('resolved_value').notNull(),
  ...timestamps,
});

export const prioritizationWeights = pgTable('prioritization_weights', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('default'),
  impactoNegocio: numeric('impacto_negocio', { precision: 6, scale: 4 }).notNull(),
  urgenciaRegulatoria: numeric('urgencia_regulatoria', { precision: 6, scale: 4 }).notNull(),
  facilidadImplementacion: numeric('facilidad_implementacion', {
    precision: 6,
    scale: 4,
  }).notNull(),
  dependenciaOtros: numeric('dependencia_otros', { precision: 6, scale: 4 }).notNull(),
  riesgoResidual: numeric('riesgo_residual', { precision: 6, scale: 4 }).notNull(),
  valorAprendizaje: numeric('valor_aprendizaje', { precision: 6, scale: 4 }).notNull(),
  ...timestamps,
});

export const prioritizationScores = pgTable('prioritization_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  weightsId: uuid('weights_id')
    .notNull()
    .references(() => prioritizationWeights.id, { onDelete: 'cascade' }),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  criteria: jsonb('criteria').notNull(),
  score: numeric('score', { precision: 8, scale: 4 }).notNull(),
  normalized: numeric('normalized', { precision: 6, scale: 2 }).notNull(),
  ...timestamps,
});

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id').references(() => assessments.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  status: text('status').notNull().default('active'),
  ...timestamps,
});

export const stages = pgTable('stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  name: stageNameEnum('name').notNull(),
  orderIndex: integer('order_index').notNull(),
  ...timestamps,
});

export const actions = pgTable('actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dimension: dimensionKeyEnum('dimension'),
  progress: actionProgressEnum('progress').notNull().default('0'),
  critical: boolean('critical').notNull().default(false),
  deletable: boolean('deletable').notNull().default(true),
  fromRisk: extendedRiskEnum('from_risk'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  dueDate: date('due_date'),
  /** Puntos (escala 0 a 100) que suma a su dimensión al llegar a 100%. */
  liftPoints: integer('lift_points').notNull().default(6),
  summary: text('summary'),
  ...timestamps,
});

export const evidences = pgTable('evidences', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  actionId: uuid('action_id')
    .notNull()
    .references(() => actions.id, { onDelete: 'cascade' }),
  status: evidenceStatusEnum('status').notNull().default('pending'),
  label: text('label').notNull(),
  url: text('url'),
  notes: text('notes'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  ...timestamps,
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  assessmentId: uuid('assessment_id').references(() => assessments.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('revision_inicial'),
  payload: jsonb('payload').notNull().default({}),
  ...timestamps,
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    meta: jsonb('meta').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_org_idx').on(t.organizationId)],
);

export const governMeta = pgTable('govern_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});


export const aiAgents = pgTable('ai_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  platform: text('platform').notNull(),
  publisher: text('publisher').notNull().default('Organización'),
  channel: text('channel').notNull().default('Interno'),
  ownerName: text('owner_name'),
  status: text('status').notNull().default('Activo'),
  risk: text('risk').notNull().default('Medio'),
  managed: boolean('managed').notNull().default(true),
  useCaseId: uuid('use_case_id').references(() => aiUseCases.id, { onDelete: 'set null' }),
  dataSources: jsonb('data_sources').notNull().default([]),
  capabilities: jsonb('capabilities').notNull().default([]),
  monthlyUsers: integer('monthly_users').notNull().default(0),
  lastActivity: date('last_activity'),
  origin: text('origin').notNull().default('manual'),
  ...timestamps,
});

export const aiUsageMetrics = pgTable('ai_usage_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  period: date('period').notNull(),
  tool: text('tool').notNull(),
  useCaseId: uuid('use_case_id').references(() => aiUseCases.id, { onDelete: 'set null' }),
  agentId: uuid('agent_id').references(() => aiAgents.id, { onDelete: 'set null' }),
  activeUsers: integer('active_users').notNull().default(0),
  requests: integer('requests').notNull().default(0),
  costMxn: integer('cost_mxn').notNull().default(0),
  incidents: integer('incidents').notNull().default(0),
  /** false = uso no autorizado (shadow AI). */
  sanctioned: boolean('sanctioned').notNull().default(true),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const actionDependencies = pgTable('action_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  /** La acción de la que se depende (prerrequisito). */
  fromActionId: uuid('from_action_id')
    .notNull()
    .references(() => actions.id, { onDelete: 'cascade' }),
  /** La acción que depende. */
  toActionId: uuid('to_action_id')
    .notNull()
    .references(() => actions.id, { onDelete: 'cascade' }),
  /** Qué tanto depende (1 a 100). */
  weight: integer('weight').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
