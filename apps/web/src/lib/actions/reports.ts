'use server';

import { and, eq } from 'drizzle-orm';
import { assessments, dimensionResults, reports } from '@onix/db';
import { DEFAULT_FEATURE_FLAGS, assistPlanDraft } from '@onix/agent';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { FEATURES } from '@/lib/features';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

export async function createReportAction(formData: FormData) {
  const session = await requireWriteAccess();
  const title = String(formData.get('title') ?? 'Informe de Revisión inicial');
  const { db } = getDb();

  await withOrg(db, session.user.organizationId, async (tx) => {
    const [assessment] = await tx
      .select()
      .from(assessments)
      .where(eq(assessments.organizationId, session.user.organizationId))
      .limit(1);
    const dims = assessment
      ? await tx.select().from(dimensionResults).where(eq(dimensionResults.assessmentId, assessment.id))
      : [];

    const [row] = await tx
      .insert(reports)
      .values({
        organizationId: session.user.organizationId,
        assessmentId: assessment?.id ?? null,
        title,
        kind: 'revision_inicial',
        payload: {
          note: 'Revisión inicial orientativa. No constituye certificación ni dictamen legal.',
          globalScore: assessment?.globalScore ?? null,
          globalLevel: assessment?.globalLevel ?? null,
          dimensions: dims.map((d) => ({ k: d.dimension, score: d.score, level: d.level })),
          body: 'Borrador generado automáticamente a partir de la evaluación publicada.',
        },
      })
      .returning();

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'report.create',
      entityType: 'report',
      entityId: row!.id,
    });
  });

  revalidatePath('/reportes');
}

export async function updateReportDraftAction(formData: FormData) {
  const session = await requireWriteAccess();
  const reportId = String(formData.get('reportId') ?? '');
  const body = String(formData.get('body') ?? '');
  const { db } = getDb();

  await withOrg(db, session.user.organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.id, reportId), eq(reports.organizationId, session.user.organizationId)))
      .limit(1);
    if (!row) throw new Error('Informe no encontrado');
    const payload = { ...(row.payload as Record<string, unknown>), body };
    await tx.update(reports).set({ payload, updatedAt: new Date() }).where(eq(reports.id, reportId));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'report.update',
      entityType: 'report',
      entityId: reportId,
    });
  });

  revalidatePath(`/reportes/${reportId}`);
}

/** Stub asistente: solo resumen de comentarios / borrador (feature-flagged). */
export async function draftReportWithAssistantAction(formData: FormData) {
  if (!FEATURES.assistant) return;
  const session = await requireWriteAccess();
  const reportId = String(formData.get('reportId') ?? '');
  const flags = { ...DEFAULT_FEATURE_FLAGS, planAssist: true, llmEnabled: false };
  const res = await assistPlanDraft(flags, {
    messages: [
      {
        role: 'user',
        content: 'Redacta un resumen ejecutivo breve de la Revisión inicial (sin afirmar certificación).',
      },
    ],
  });

  if (res?.content) {
    const { db } = getDb();
    await withOrg(db, session.user.organizationId, async (tx) => {
      const [row] = await tx.select().from(reports).where(eq(reports.id, reportId)).limit(1);
      if (!row) return;
      const payload = {
        ...(row.payload as Record<string, unknown>),
        body: res.content,
        assistantStub: true,
      };
      await tx.update(reports).set({ payload, updatedAt: new Date() }).where(eq(reports.id, reportId));
    });
    revalidatePath(`/reportes/${reportId}`);
  }
}
