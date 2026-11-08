'use server';

import { and, eq } from 'drizzle-orm';
import { reports } from '@onix/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { loadOrgOverview } from '@/lib/server/insights';
import { writeWithAssistant } from '@/lib/server/narrative';
import { REPORT_KINDS, type ReportKind } from '@/lib/report-kinds';
import { requireWriteAccess } from '@/lib/session';

const NOTE = 'Revisión orientativa con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador.';

/** CU-11: crea un informe con su resumen redactado; las secciones se arman con los datos vigentes. */
export async function createReportAction(formData: FormData) {
  const session = await requireWriteAccess();
  const raw = String(formData.get('kind') ?? 'evaluacion');
  const kind: ReportKind = raw in REPORT_KINDS ? (raw as ReportKind) : 'evaluacion';
  const orgId = session.user.organizationId;
  const o = await loadOrgOverview(orgId);
  const task = kind === 'avance' ? 'siguientes_pasos' : 'resumen_ejecutivo';
  const draft = await writeWithAssistant(task, o, session.user.organizationName ?? '');
  const evalTitle = o.official?.title ?? 'Revisión inicial';
  const date = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const title =
    kind === 'evaluacion' ? `Informe de ${evalTitle}` : kind === 'direccion' ? `Resumen para dirección · ${date}` : `Avance del plan · ${date}`;

  const { db } = getDb();
  const id = await withOrg(db, orgId, async (tx) => {
    const [row] = await tx
      .insert(reports)
      .values({
        organizationId: orgId,
        assessmentId: o.official?.id ?? null,
        title,
        kind,
        payload: {
          note: NOTE,
          body: draft.text,
          bodySource: draft.source,
          globalScore: o.official?.globalScore ?? null,
          globalLevel: o.official?.globalLevel ?? null,
          dimensions: o.officialDims.map((d) => ({ k: d.dimension, score: d.score, level: d.level })),
          planPct: o.planPct,
        },
      })
      .returning();
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'report.create',
      entityType: 'report',
      entityId: row!.id,
      meta: { kind, source: draft.source },
    });
    return row!.id;
  });

  revalidatePath('/reportes');
  redirect(`/reportes/${id}`);
}

export async function updateReportDraftAction(formData: FormData) {
  const session = await requireWriteAccess();
  const reportId = String(formData.get('reportId') ?? '');
  const body = String(formData.get('body') ?? '').slice(0, 8000);
  const title = String(formData.get('title') ?? '').trim().slice(0, 160);
  const { db } = getDb();

  await withOrg(db, session.user.organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.id, reportId), eq(reports.organizationId, session.user.organizationId)))
      .limit(1);
    if (!row) throw new Error('Informe no encontrado');
    const payload = { ...(row.payload as Record<string, unknown>), body, bodySource: 'editado' };
    await tx
      .update(reports)
      .set({ payload, title: title || row.title, updatedAt: new Date() })
      .where(and(eq(reports.id, reportId), eq(reports.organizationId, session.user.organizationId)));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'report.update',
      entityType: 'report',
      entityId: reportId,
    });
  });

  revalidatePath(`/reportes/${reportId}`);
  revalidatePath('/reportes');
}

/** Vuelve a redactar el resumen con el asistente (sugerencia; el texto anterior se reemplaza). */
export async function redraftReportAction(formData: FormData) {
  const session = await requireWriteAccess();
  const reportId = String(formData.get('reportId') ?? '');
  const orgId = session.user.organizationId;
  const { db } = getDb();
  const [row] = await withOrg(db, orgId, (tx) =>
    tx.select().from(reports).where(and(eq(reports.id, reportId), eq(reports.organizationId, orgId))).limit(1),
  );
  if (!row) throw new Error('Informe no encontrado');
  const o = await loadOrgOverview(orgId);
  const draft = await writeWithAssistant(row.kind === 'avance' ? 'siguientes_pasos' : 'resumen_ejecutivo', o, session.user.organizationName ?? '');
  await withOrg(db, orgId, async (tx) => {
    const payload = { ...(row.payload as Record<string, unknown>), body: draft.text, bodySource: draft.source };
    await tx.update(reports).set({ payload, updatedAt: new Date() }).where(and(eq(reports.id, reportId), eq(reports.organizationId, orgId)));
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'report.redraft',
      entityType: 'report',
      entityId: reportId,
      meta: { source: draft.source },
    });
  });
  revalidatePath(`/reportes/${reportId}`);
}
