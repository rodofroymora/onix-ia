'use server';

import { and, desc, eq } from 'drizzle-orm';
import {
  answers,
  assessments,
  dimensionResults,
  gaps,
  invitations,
  organizations,
  questions,
  questionnaireVersions,
} from '@onix/db';
import type { GovernTx } from '@onix/db';
import { aggregateRespondentAnswers, compute, findGaps, type RespondentAnswer } from '@onix/engine';
import { FUNCTIONS, maturityForRoute } from '@onix/templates';
import { sendInvitationEmail } from '@/lib/notify';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import {
  createRespondentExpiry,
  signRespondentToken,
  verifyRespondentToken,
} from '@/lib/respondent-token';
import { requireWriteAccess } from '@/lib/session';
import { randomBytes } from 'node:crypto';

/** CU-02: lanzar evaluación (ruta 15/27/38). */
export async function launchAssessmentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const route = Number(formData.get('route') ?? 38) as 15 | 27 | 38;
  if (![15, 27, 38].includes(route)) throw new Error('Ruta inválida');

  const { db } = getDb();
  const [qv] = await db
    .select()
    .from(questionnaireVersions)
    .where(eq(questionnaireVersions.version, 'v1'))
    .limit(1);
  if (!qv) throw new Error('Cuestionario v1 no encontrado. Ejecuta db:seed.');

  await withOrg(db, session.user.organizationId, async (tx) => {
    // Si ya hay una evaluación publicada, la nueva es una reevaluación con la misma versión (CU-13).
    const [previous] = await tx
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.organizationId, session.user.organizationId),
          eq(assessments.status, 'completed'),
        ),
      )
      .orderBy(desc(assessments.createdAt))
      .limit(1);
    const isReeval = Boolean(previous);
    const [row] = await tx
      .insert(assessments)
      .values({
        organizationId: session.user.organizationId,
        questionnaireVersionId: previous?.questionnaireVersionId ?? qv.id,
        title: isReeval ? 'Reevaluación' : 'Revisión inicial',
        status: 'in_progress',
        saasRoute: isReeval ? (previous!.saasRoute ?? route) : route,
        kind: isReeval ? 'reevaluacion' : 'inicial',
        previousAssessmentId: previous?.id ?? null,
        createdBy: session.user.id,
      })
      .returning();

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'assessment.launch',
      entityType: 'assessment',
      entityId: row!.id,
      meta: { route, kind: row!.kind },
    });
  });

  revalidatePath('/evaluacion');
}

type Tx = GovernTx;

/** Crea la invitación con su enlace firmado (HMAC) y devuelve el token. */
async function createInvitation(
  tx: Tx,
  input: { organizationId: string; assessmentId: string; email: string; name: string | null; functions: string[]; actorUserId: string },
): Promise<string> {
  const [inv] = await tx
    .insert(invitations)
    .values({
      organizationId: input.organizationId,
      assessmentId: input.assessmentId,
      email: input.email,
      respondentName: input.name,
      functions: input.functions,
      role: 'member',
      status: 'pending',
      token: randomBytes(16).toString('hex'),
      expiresAt: new Date(createRespondentExpiry()),
    })
    .returning();
  const signed = signRespondentToken({
    invitationId: inv!.id,
    assessmentId: input.assessmentId,
    organizationId: input.organizationId,
    email: input.email,
    exp: createRespondentExpiry(),
  });
  await tx.update(invitations).set({ token: signed }).where(eq(invitations.id, inv!.id));
  await appendAudit(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: 'invitation.create',
    entityType: 'invitation',
    entityId: inv!.id,
    meta: { email: input.email },
  });
  return signed;
}

async function assertAssessmentInOrg(tx: Tx, assessmentId: string, organizationId: string) {
  const [assessment] = await tx
    .select({ id: assessments.id, status: assessments.status })
    .from(assessments)
    .where(and(eq(assessments.id, assessmentId), eq(assessments.organizationId, organizationId)))
    .limit(1);
  if (!assessment) throw new Error('Evaluación no encontrada en tu organización');
  if (assessment.status === 'completed') throw new Error('La evaluación ya se publicó');
  return assessment;
}

/** CU-03: invitar respondente con magic link firmado y mandarle el correo si hay proveedor. */
export async function inviteRespondentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const assessmentId = String(formData.get('assessmentId') ?? '');
  const respondentName = String(formData.get('name') ?? '').trim().slice(0, 120) || null;
  const validFns = new Set(FUNCTIONS.map((f) => f.k as string));
  const fns = formData
    .getAll('functions')
    .map(String)
    .filter((f) => validFns.has(f));
  if (!email || !assessmentId) throw new Error('Datos incompletos');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo inválido');

  const { db } = getDb();
  const signed = await withOrg(db, session.user.organizationId, async (tx) => {
    await assertAssessmentInOrg(tx, assessmentId, session.user.organizationId);
    // Si ya tiene invitación pendiente en esta evaluación, se reenvía la misma.
    const [existing] = await tx
      .select({ token: invitations.token })
      .from(invitations)
      .where(
        and(
          eq(invitations.assessmentId, assessmentId),
          eq(invitations.organizationId, session.user.organizationId),
          eq(invitations.email, email),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);
    if (existing) return existing.token;
    return createInvitation(tx, {
      organizationId: session.user.organizationId,
      assessmentId,
      email,
      name: respondentName,
      functions: fns,
      actorUserId: session.user.id,
    });
  });

  let mail: 'enviado' | 'sin_config' | 'error' = 'sin_config';
  try {
    const r = await sendInvitationEmail({
      to: email,
      name: respondentName,
      organizationName: session.user.organizationName ?? '',
      token: signed,
    });
    mail = r === 'sent' ? 'enviado' : 'sin_config';
  } catch (err) {
    console.error('[invitacion] no se pudo enviar el correo', err);
    mail = 'error';
  }

  revalidatePath('/evaluacion');
  redirect(`/evaluacion?tab=seguimiento&correo=${mail}`);
}

/** Abre el cuestionario para la persona con sesión (sin correo): reutiliza su invitación si existe. */
export async function answerMyselfAction(formData: FormData) {
  const session = await requireWriteAccess();
  const assessmentId = String(formData.get('assessmentId') ?? '');
  const email = (session.user.email ?? '').toLowerCase();
  if (!email) throw new Error('Tu usuario no tiene correo');
  const validFns = new Set(FUNCTIONS.map((f) => f.k as string));
  const picked = formData.getAll('functions').map(String).filter((f) => validFns.has(f));
  const fns = picked.length ? picked : FUNCTIONS.map((f) => f.k as string);

  const { db } = getDb();
  const token = await withOrg(db, session.user.organizationId, async (tx) => {
    await assertAssessmentInOrg(tx, assessmentId, session.user.organizationId);
    const [mine] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.assessmentId, assessmentId),
          eq(invitations.organizationId, session.user.organizationId),
          eq(invitations.email, email),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);
    if (mine) return mine.token;
    return createInvitation(tx, {
      organizationId: session.user.organizationId,
      assessmentId,
      email,
      name: session.user.name ?? null,
      functions: fns,
      actorUserId: session.user.id,
    });
  });
  redirect(`/r/${encodeURIComponent(token)}?desde=app`);
}

/** Cada cuántos meses toca reevaluar (recordatorio configurable). */
export async function saveReevaluationMonthsAction(formData: FormData) {
  const session = await requireWriteAccess();
  const months = Math.round(Number(formData.get('months')));
  if (!Number.isFinite(months) || months < 1 || months > 24) throw new Error('Elige entre 1 y 24 meses');
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx
      .update(organizations)
      .set({ reevaluationMonths: months, updatedAt: new Date() })
      .where(eq(organizations.id, session.user.organizationId));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'organization.reevaluation_months',
      entityType: 'organization',
      entityId: session.user.organizationId,
      meta: { months },
    });
  });
  revalidatePath('/evaluacion');
  revalidatePath('/');
}

/** CU-04: publicar evaluación → compute oficial + proyección de brechas. */
export async function publishAssessmentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const assessmentId = String(formData.get('assessmentId') ?? '');
  const { db } = getDb();
  let redirectTo = '/evaluacion?tab=resultados';

  await withOrg(db, session.user.organizationId, async (tx) => {
    const [assessment] = await tx
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.id, assessmentId),
          eq(assessments.organizationId, session.user.organizationId),
        ),
      )
      .limit(1);
    if (!assessment) throw new Error('Evaluación no encontrada');

    // Se publica cuando todos contestaron; con pendientes solo si se confirma.
    const invs = await tx.select().from(invitations).where(eq(invitations.assessmentId, assessmentId));
    const pending = invs.filter((i) => i.status === 'pending').length;
    const done = invs.filter((i) => i.status === 'accepted').length;
    if (done === 0) {
      redirectTo = '/evaluacion?tab=seguimiento&publicar=sin_respuestas';
      return;
    }
    if (pending > 0 && formData.get('force') !== '1') {
      redirectTo = `/evaluacion?tab=seguimiento&publicar=faltan&n=${pending}`;
      return;
    }

    const route = (assessment.saasRoute ?? 38) as 15 | 27 | 38;
    const qs = await tx
      .select()
      .from(questions)
      .where(eq(questions.questionnaireVersionId, assessment.questionnaireVersionId));
    const ans = await tx.select().from(answers).where(eq(answers.assessmentId, assessmentId));

    const routeQs = maturityForRoute(route);
    // Varios respondentes: promedio por pregunta; "No sé" no suma nivel (CU-04).
    const flat: RespondentAnswer[] = [];
    for (const a of ans) {
      const q = qs.find((x) => x.id === a.questionId);
      if (!q || q.kind !== 'maturity' || !q.dimension) continue;
      flat.push({
        respondentId: a.invitationId ?? a.userId ?? 'consultor',
        questionCode: q.code,
        dimension: q.dimension,
        value: a.valueText === 'no_se' ? null : a.valueInt,
      });
    }
    const m = aggregateRespondentAnswers(
      routeQs.map((rq) => rq.code),
      flat,
    );

    const result = compute({
      m,
      proc: 2,
      aut: 2,
      pres: 2,
      datos: 2,
      afect: 2,
      area: 0,
    });
    if (!result) throw new Error('No se pudo calcular madurez');

    await tx
      .update(assessments)
      .set({
        status: 'completed',
        publishedAt: new Date(),
        globalScore: result.gs,
        globalLevel: result.gl,
        routeIndex: result.route,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assessments.id, assessmentId),
          eq(assessments.organizationId, session.user.organizationId),
        ),
      );

    await tx
      .delete(dimensionResults)
      .where(
        and(
          eq(dimensionResults.assessmentId, assessmentId),
          eq(dimensionResults.organizationId, session.user.organizationId),
        ),
      );
    for (const d of result.dims) {
      await tx.insert(dimensionResults).values({
        organizationId: session.user.organizationId,
        assessmentId,
        dimension: d.k,
        score: d.s,
        level: d.l,
      });
    }

    await tx
      .delete(gaps)
      .where(
        and(
          eq(gaps.assessmentId, assessmentId),
          eq(gaps.organizationId, session.user.organizationId),
        ),
      );
    for (const g of findGaps(result.dims)) {
      await tx.insert(gaps).values({
        organizationId: session.user.organizationId,
        assessmentId,
        fromDimension: g.from,
        toDimension: g.to,
        fromLevel: g.fromLevel,
        toLevel: g.toLevel,
        delta: g.delta,
      });
    }

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'assessment.publish',
      entityType: 'assessment',
      entityId: assessmentId,
      meta: { gs: result.gs, gl: result.gl, official: true, pending },
    });
  });

  revalidatePath('/evaluacion');
  revalidatePath('/');
  redirect(redirectTo);
}

/** Autosave respondente / "No sé". Requiere magic link HMAC válido. */
export async function saveRespondentAnswerAction(input: {
  token: string;
  questionId: string;
  valueInt: number | null;
  valueText?: string | null;
}) {
  const payload = verifyRespondentToken(input.token);
  if (!payload) throw new Error('Token de respondente inválido');
  if (!input.questionId) throw new Error('Pregunta requerida');
  const isNoSe = input.valueText === 'no_se';
  if (isNoSe) {
    if (input.valueInt !== null) throw new Error('Respuesta inválida');
  } else {
    if (input.valueText != null) throw new Error('Respuesta inválida');
    if (!Number.isInteger(input.valueInt) || input.valueInt! < 1 || input.valueInt! > 4) {
      throw new Error('La respuesta debe ser un nivel de 1 a 4');
    }
  }

  const { db } = getDb();
  await withOrg(db, payload.organizationId, async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, payload.invitationId),
          eq(invitations.organizationId, payload.organizationId),
          eq(invitations.assessmentId, payload.assessmentId),
        ),
      )
      .limit(1);
    if (!inv || inv.status !== 'pending') throw new Error('Invitación no válida');
    if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
      throw new Error('Invitación expirada');
    }

    const [assessment] = await tx
      .select({ id: assessments.id, questionnaireVersionId: assessments.questionnaireVersionId })
      .from(assessments)
      .where(
        and(
          eq(assessments.id, payload.assessmentId),
          eq(assessments.organizationId, payload.organizationId),
        ),
      )
      .limit(1);
    if (!assessment) throw new Error('Evaluación no válida para esta organización');

    // La pregunta debe pertenecer a la versión congelada del cuestionario de esta evaluación.
    const [question] = await tx
      .select({ id: questions.id, kind: questions.kind })
      .from(questions)
      .where(
        and(
          eq(questions.id, input.questionId),
          eq(questions.questionnaireVersionId, assessment.questionnaireVersionId),
        ),
      )
      .limit(1);
    if (!question || question.kind !== 'maturity') {
      throw new Error('La pregunta no pertenece a esta evaluación');
    }

    const existing = await tx
      .select()
      .from(answers)
      .where(
        and(
          eq(answers.assessmentId, payload.assessmentId),
          eq(answers.organizationId, payload.organizationId),
          eq(answers.questionId, input.questionId),
          eq(answers.invitationId, payload.invitationId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await tx
        .update(answers)
        .set({
          valueInt: input.valueInt,
          valueText: input.valueText ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(answers.id, existing[0].id),
            eq(answers.organizationId, payload.organizationId),
          ),
        );
    } else {
      await tx.insert(answers).values({
        organizationId: payload.organizationId,
        assessmentId: payload.assessmentId,
        questionId: input.questionId,
        invitationId: payload.invitationId,
        valueInt: input.valueInt,
        valueText: input.valueText ?? null,
      });
    }

    if (input.valueText === 'no_se') {
      await appendAudit(tx, {
        organizationId: payload.organizationId,
        action: 'answer.no_se',
        entityType: 'answer',
        entityId: input.questionId,
        meta: { assessmentId: payload.assessmentId, invitationId: payload.invitationId },
      });
    }
  });
}

export async function consumeInvitationAction(token: string) {
  const payload = verifyRespondentToken(token);
  if (!payload) throw new Error('Token de respondente inválido');

  const { db } = getDb();
  await withOrg(db, payload.organizationId, async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, payload.invitationId),
          eq(invitations.organizationId, payload.organizationId),
          eq(invitations.assessmentId, payload.assessmentId),
        ),
      )
      .limit(1);
    if (!inv || inv.status !== 'pending') throw new Error('Invitación no válida');

    await tx
      .update(invitations)
      .set({ status: 'accepted', completedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(invitations.id, payload.invitationId),
          eq(invitations.organizationId, payload.organizationId),
        ),
      );
  });
}
