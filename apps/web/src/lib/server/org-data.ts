import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import {
  userInvites,
  actions,
  aiUseCases,
  assessments,
  auditLogs,
  dimensionResults,
  evidences,
  gaps,
  invitations,
  organizations,
  plans,
  prioritizationWeights,
  reports,
  responsibilityMaps,
  stages,
  techProfiles,
  triageValidations,
  users,
  memberships,
} from '@onix/db';
import { getDb, withOrg } from '@/lib/db';

export async function loadDashboard(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const [assessment] = await tx
      .select()
      .from(assessments)
      .where(eq(assessments.organizationId, organizationId))
      .orderBy(desc(assessments.updatedAt))
      .limit(1);

    const dims = assessment
      ? await tx
          .select()
          .from(dimensionResults)
          .where(eq(dimensionResults.assessmentId, assessment.id))
      : [];

    const planRows = await tx.select().from(plans).where(eq(plans.organizationId, organizationId)).limit(1);
    const actionRows = planRows[0]
      ? await tx.select().from(actions).where(eq(actions.planId, planRows[0].id))
      : [];

    const cases = await tx.select().from(aiUseCases).where(eq(aiUseCases.organizationId, organizationId));

    return { assessment, dims, plan: planRows[0] ?? null, actions: actionRows, cases };
  });
}

export async function loadAssessmentBundle(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const [assessment] = await tx
      .select()
      .from(assessments)
      .where(eq(assessments.organizationId, organizationId))
      .orderBy(desc(assessments.updatedAt))
      .limit(1);

    if (!assessment) {
      return { assessment: null, dims: [], gapRows: [], tech: [], invitations: [] };
    }

    const dims = await tx
      .select()
      .from(dimensionResults)
      .where(eq(dimensionResults.assessmentId, assessment.id));
    const gapRows = await tx.select().from(gaps).where(eq(gaps.assessmentId, assessment.id));
    const tech = await tx.select().from(techProfiles).where(eq(techProfiles.organizationId, organizationId));
    const invites = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.assessmentId, assessment.id));

    return { assessment, dims, gapRows, tech, invitations: invites };
  });
}

export async function loadInventory(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const cases = await tx
      .select()
      .from(aiUseCases)
      .where(eq(aiUseCases.organizationId, organizationId))
      .orderBy(desc(aiUseCases.updatedAt));
    const validations = await tx
      .select()
      .from(triageValidations)
      .where(eq(triageValidations.organizationId, organizationId))
      .orderBy(desc(triageValidations.updatedAt));
    return { cases, validations };
  });
}

export async function loadPrioritization(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const [weights] = await tx
      .select()
      .from(prioritizationWeights)
      .where(eq(prioritizationWeights.organizationId, organizationId))
      .limit(1);
    const cases = await tx.select().from(aiUseCases).where(eq(aiUseCases.organizationId, organizationId));
    return { weights: weights ?? null, cases };
  });
}

export async function loadPlanBundle(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const [plan] = await tx.select().from(plans).where(eq(plans.organizationId, organizationId)).limit(1);
    if (!plan) return { plan: null, stages: [], actions: [], evidences: [] };
    const stageRows = await tx.select().from(stages).where(eq(stages.planId, plan.id));
    const actionRows = await tx.select().from(actions).where(eq(actions.planId, plan.id));
    const evidenceRows = actionRows.length
      ? await tx.select().from(evidences).where(eq(evidences.organizationId, organizationId))
      : [];
    return { plan, stages: stageRows, actions: actionRows, evidences: evidenceRows };
  });
}

export async function loadReports(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    return tx
      .select()
      .from(reports)
      .where(eq(reports.organizationId, organizationId))
      .orderBy(desc(reports.updatedAt));
  });
}

export async function loadReport(organizationId: string, reportId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.organizationId, organizationId), eq(reports.id, reportId)))
      .limit(1);
    return row ?? null;
  });
}

export async function loadOrganizationPage(organizationId: string) {
  const { db } = getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return withOrg(db, organizationId, async (tx) => {
    const maps = await tx
      .select()
      .from(responsibilityMaps)
      .where(eq(responsibilityMaps.organizationId, organizationId));
    const members = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organizationId, organizationId));
    const invites = await tx
      .select({ id: userInvites.id, email: userInvites.email, name: userInvites.name, role: userInvites.role, asConsultant: userInvites.asConsultant, expiresAt: userInvites.expiresAt })
      .from(userInvites)
      .where(and(eq(userInvites.organizationId, organizationId), isNull(userInvites.acceptedAt), gt(userInvites.expiresAt, new Date())));
    return { org: org ?? null, maps, members, invites };
  });
}

export async function loadAllOrganizations() {
  const { db } = getDb();
  return db.select().from(organizations).orderBy(organizations.name);
}

export async function loadAuditLog(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    return tx
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  });
}
