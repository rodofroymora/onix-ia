'use server';

import { and, eq } from 'drizzle-orm';
import {
  answers,
  assessments,
  dimensionResults,
  gaps,
  invitations,
  questions,
  questionnaireVersions,
} from '@onix/db';
import { compute, findGaps } from '@onix/engine';
import { maturityForRoute } from '@onix/templates';
import { revalidatePath } from 'next/cache';
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

  const id = await withOrg(db, session.user.organizationId, async (tx) => {
    const [row] = await tx
      .insert(assessments)
      .values({
        organizationId: session.user.organizationId,
        questionnaireVersionId: qv.id,
        title: `Revisión inicial — ruta ${route}`,
        status: 'in_progress',
        saasRoute: route,
        createdBy: session.user.id,
      })
      .returning();

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'assessment.launch',
      entityType: 'assessment',
      entityId: row!.id,
      meta: { route },
    });
    return row!.id;
  });

  revalidatePath('/evaluacion');
}

/** CU-03: invitar respondente con magic link firmado. */
export async function inviteRespondentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const assessmentId = String(formData.get('assessmentId') ?? '');
  if (!email || !assessmentId) throw new Error('Datos incompletos');

  const raw = randomBytes(16).toString('hex');
  const { db } = getDb();

  await withOrg(db, session.user.organizationId, async (tx) => {
    const [inv] = await tx
      .insert(invitations)
      .values({
        organizationId: session.user.organizationId,
        assessmentId,
        email,
        role: 'member',
        status: 'pending',
        token: raw,
        expiresAt: new Date(createRespondentExpiry()),
      })
      .returning();

    const signed = signRespondentToken({
      invitationId: inv!.id,
      assessmentId,
      organizationId: session.user.organizationId,
      email,
      exp: createRespondentExpiry(),
    });

    // Guardamos el token firmado (HMAC) como token de acceso.
    await tx.update(invitations).set({ token: signed }).where(eq(invitations.id, inv!.id));

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'invitation.create',
      entityType: 'invitation',
      entityId: inv!.id,
      meta: { email },
    });
  });

  revalidatePath('/evaluacion');
}

/** CU-04: publicar evaluación → compute oficial + proyección de brechas. */
export async function publishAssessmentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const assessmentId = String(formData.get('assessmentId') ?? '');
  const { db } = getDb();

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

    const route = (assessment.saasRoute ?? 38) as 15 | 27 | 38;
    const qs = await tx
      .select()
      .from(questions)
      .where(eq(questions.questionnaireVersionId, assessment.questionnaireVersionId));
    const ans = await tx.select().from(answers).where(eq(answers.assessmentId, assessmentId));

    const routeQs = maturityForRoute(route);
    const m: number[] = [];
    for (const rq of routeQs) {
      const q = qs.find((x) => x.code === rq.code);
      const a = q ? ans.find((x) => x.questionId === q.id) : undefined;
      // "No sé" u omitido → 1 (Inicial) y se registra como hallazgo vía valueText
      if (!a || a.valueInt == null) {
        m.push(1);
      } else {
        m.push(a.valueInt);
      }
    }

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
        globalScore: result.gs,
        globalLevel: result.gl,
        routeIndex: result.route,
        updatedAt: new Date(),
      })
      .where(eq(assessments.id, assessmentId));

    await tx.delete(dimensionResults).where(eq(dimensionResults.assessmentId, assessmentId));
    for (const d of result.dims) {
      await tx.insert(dimensionResults).values({
        organizationId: session.user.organizationId,
        assessmentId,
        dimension: d.k,
        score: d.s,
        level: d.l,
      });
    }

    await tx.delete(gaps).where(eq(gaps.assessmentId, assessmentId));
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
      meta: { gs: result.gs, gl: result.gl, official: true },
    });
  });

  revalidatePath('/evaluacion');
  revalidatePath('/');
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

    const existing = await tx
      .select()
      .from(answers)
      .where(
        and(
          eq(answers.assessmentId, payload.assessmentId),
          eq(answers.questionId, input.questionId),
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
        .where(eq(answers.id, existing[0].id));
    } else {
      await tx.insert(answers).values({
        organizationId: payload.organizationId,
        assessmentId: payload.assessmentId,
        questionId: input.questionId,
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
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(invitations.id, payload.invitationId));
  });
}
