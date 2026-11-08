import { eq } from 'drizzle-orm';
import { answers, invitations, questions, assessments } from '@onix/db';
import { notFound, redirect } from 'next/navigation';
import {
  consumeInvitationAction,
  saveRespondentAnswerAction,
} from '@/lib/actions/assessments';
import { getDb, withOrg } from '@/lib/db';
import { verifyRespondentToken } from '@/lib/respondent-token';
import { RespondentWizard } from '@/components/panels/RespondentWizard';

async function findInvitation(id: string) {
  const { db } = getDb();
  const [inv] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  return inv ?? null;
}

export default async function RespondentPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ q?: string; done?: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const sp = await searchParams;

  if (sp.done === '1') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
        <div className="onix-panel p-6 text-center">
          <p className="font-display text-xl text-ink">Respuestas enviadas</p>
          <p className="mt-2 text-sm text-ink-muted">
            Gracias. El enlace de acceso era de un solo uso.
          </p>
        </div>
      </div>
    );
  }

  const payload = verifyRespondentToken(token);
  if (!payload) notFound();

  const { db } = getDb();
  const invitation = await findInvitation(payload.invitationId);
  if (!invitation) notFound();
  if (
    invitation.organizationId !== payload.organizationId ||
    invitation.assessmentId !== payload.assessmentId
  ) {
    notFound();
  }
  if (invitation.status === 'accepted' || invitation.status === 'revoked' || invitation.status === 'expired') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
        <div className="onix-panel p-6 text-center">
          <p className="font-display text-xl text-ink">Enlace no disponible</p>
          <p className="mt-2 text-sm text-ink-muted">
            Este enlace ya se usó o expiró. Pide una nueva invitación.
          </p>
        </div>
      </div>
    );
  }
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <p className="text-sm text-ink-muted">La invitación expiró.</p>
      </div>
    );
  }

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, payload.assessmentId))
    .limit(1);
  if (!assessment) notFound();

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.questionnaireVersionId, assessment.questionnaireVersionId));

  const maturityQs = qs
    .filter((q) => q.kind === 'maturity')
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const routeCount = assessment.saasRoute ?? 38;
  const routeQs = maturityQs.slice(0, routeCount);

  const existingAnswers = await withOrg(db, payload.organizationId, async (tx) => {
    return tx.select().from(answers).where(eq(answers.assessmentId, payload!.assessmentId));
  });

  const idx = Math.min(Math.max(Number(sp.q ?? 0), 0), Math.max(routeQs.length - 1, 0));
  const current = routeQs[idx];
  if (!current) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
        <div className="onix-panel p-6 text-center">
          <p className="font-display text-xl text-ink">Gracias</p>
          <p className="mt-2 text-sm text-ink-muted">No hay preguntas en esta evaluación.</p>
        </div>
      </div>
    );
  }

  const currentAnswer = existingAnswers.find((a) => a.questionId === current.id);
  const orgId = payload.organizationId;
  const assessmentId = payload.assessmentId;
  const invitationId = payload.invitationId;

  async function saveAction(formData: FormData) {
    'use server';
    const questionId = String(formData.get('questionId'));
    const choice = String(formData.get('choice'));
    const next = String(formData.get('next') ?? 'next');
    const tokenValue = String(formData.get('token'));
    const qIndex = Number(formData.get('qIndex'));

    if (choice === 'no_se') {
      await saveRespondentAnswerAction({
        token: tokenValue,
        questionId,
        valueInt: null,
        valueText: 'no_se',
      });
    } else if (choice) {
      await saveRespondentAnswerAction({
        token: tokenValue,
        questionId,
        valueInt: Number(choice),
        valueText: null,
      });
    }

    if (next === 'finish') {
      await consumeInvitationAction(tokenValue);
      redirect(`/r/${encodeURIComponent(tokenValue)}?done=1`);
    }

    const dest = next === 'prev' ? Math.max(0, qIndex - 1) : qIndex + 1;
    redirect(`/r/${encodeURIComponent(tokenValue)}?q=${dest}`);
  }

  return (
    <RespondentWizard
      token={token}
      organizationId={orgId}
      assessmentId={assessmentId}
      invitationId={invitationId}
      question={current}
      qIndex={idx}
      total={routeQs.length}
      currentValue={currentAnswer?.valueText === 'no_se' ? 'no_se' : currentAnswer?.valueInt ?? null}
      saveAction={saveAction}
    />
  );
}
