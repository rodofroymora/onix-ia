'use server';

import { and, eq } from 'drizzle-orm';
import { actions, evidences, plans, stages, type GovernTx } from '@onix/db';
import { ACTION_LIBRARY } from '@onix/templates';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireConsultant, requireWriteAccess } from '@/lib/session';

/** CU-09: poblar plan desde biblioteca de acciones. */
export async function seedPlanFromLibraryAction() {
  const session = await requireWriteAccess();
  const { db } = getDb();

  await withOrg(db, session.user.organizationId, async (tx) => {
    let [plan] = await tx
      .select()
      .from(plans)
      .where(eq(plans.organizationId, session.user.organizationId))
      .limit(1);

    if (!plan) {
      const [created] = await tx
        .insert(plans)
        .values({
          organizationId: session.user.organizationId,
          title: 'Plan de gobierno IA',
        })
        .returning();
      plan = created!;
      const names = ['Bases', 'Controles', 'Mejora continua'] as const;
      for (let i = 0; i < names.length; i++) {
        await tx.insert(stages).values({
          organizationId: session.user.organizationId,
          planId: plan.id,
          name: names[i]!,
          orderIndex: i,
        });
      }
    }

    const stageRows = await tx.select().from(stages).where(eq(stages.planId, plan.id));
    const existingTitles = new Set(
      (await tx.select({ title: actions.title }).from(actions).where(eq(actions.planId, plan.id))).map((a) => a.title),
    );
    for (const tpl of ACTION_LIBRARY) {
      const stage = stageRows.find((s) => s.name === tpl.stage) ?? stageRows[0];
      if (!stage || existingTitles.has(tpl.title)) continue;
      await tx.insert(actions).values({
        summary: tpl.summary,
        organizationId: session.user.organizationId,
        planId: plan.id,
        stageId: stage.id,
        title: tpl.title,
        dimension: tpl.dimension,
        progress: '0',
        critical: tpl.stage === 'Bases',
        deletable: true,
      });
    }

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'plan.seed_library',
      entityType: 'plan',
      entityId: plan.id,
    });
  });

  revalidatePath('/plan');
}

const STEPS = ['0', '25', '50', '75', '100'] as const;
type Step = (typeof STEPS)[number];

async function loadAction(tx: GovernTx, orgId: string, actionId: string) {
  const [row] = await tx
    .select()
    .from(actions)
    .where(and(eq(actions.id, actionId), eq(actions.organizationId, orgId)))
    .limit(1);
  if (!row) throw new Error('Acción no encontrada');
  return row;
}

/** CU-12: avance por pasos fijos y fecha. El 100% solo se alcanza con evidencia aprobada. */
export async function updateActionProgressAction(formData: FormData) {
  const session = await requireWriteAccess();
  const actionId = String(formData.get('actionId') ?? '');
  const claimed = String(formData.get('progress') ?? '0');
  if (!(STEPS as readonly string[]).includes(claimed)) throw new Error('Avance inválido');
  const due = String(formData.get('dueDate') ?? '');
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const row = await loadAction(tx, session.user.organizationId, actionId);
    const ev = await tx
      .select()
      .from(evidences)
      .where(and(eq(evidences.actionId, actionId), eq(evidences.organizationId, session.user.organizationId)));
    const approved = ev.some((e) => e.status === 'approved');
    const progress: Step = claimed === '100' && !approved ? '75' : (claimed as Step);
    await tx
      .update(actions)
      .set({ progress, dueDate: dueDate ?? row.dueDate, updatedAt: new Date() })
      .where(eq(actions.id, row.id));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'action.progress',
      entityType: 'action',
      entityId: row.id,
      meta: { claimed, progress, blockedClose: claimed === '100' && !approved },
    });
  });
  revalidatePath('/plan');
  revalidatePath('/');
}

/** El dueño sube evidencia (documento o enlace); queda pendiente de revisión. */
export async function submitEvidenceAction(formData: FormData) {
  const session = await requireWriteAccess();
  const actionId = String(formData.get('actionId') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 200);
  const urlRaw = String(formData.get('url') ?? '').trim();
  const url = /^https?:\/\//i.test(urlRaw) ? urlRaw.slice(0, 500) : null;
  if (!label) throw new Error('Describe la evidencia');
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const row = await loadAction(tx, session.user.organizationId, actionId);
    const [ev] = await tx
      .insert(evidences)
      .values({ organizationId: session.user.organizationId, actionId: row.id, status: 'pending', label, url, notes: null })
      .returning();
    if (Number(row.progress) < 75) {
      await tx.update(actions).set({ progress: '75', updatedAt: new Date() }).where(eq(actions.id, row.id));
    }
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'evidence.submit',
      entityType: 'evidence',
      entityId: ev!.id,
      meta: { actionId: row.id },
    });
  });
  revalidatePath('/plan');
}

/** El consultor (o responsable designado) aprueba o rechaza: aprobada cierra al 100%, rechazada regresa a 75%. */
export async function reviewEvidenceAction(formData: FormData) {
  const session = await requireConsultant();
  const evidenceId = String(formData.get('evidenceId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 400) || null;
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Decisión inválida');
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const [ev] = await tx
      .select()
      .from(evidences)
      .where(and(eq(evidences.id, evidenceId), eq(evidences.organizationId, session.user.organizationId)))
      .limit(1);
    if (!ev) throw new Error('Evidencia no encontrada');
    await tx
      .update(evidences)
      .set({ status: decision as 'approved' | 'rejected', notes, reviewedBy: session.user.id, updatedAt: new Date() })
      .where(eq(evidences.id, ev.id));
    await tx
      .update(actions)
      .set({ progress: decision === 'approved' ? '100' : '75', updatedAt: new Date() })
      .where(and(eq(actions.id, ev.actionId), eq(actions.organizationId, session.user.organizationId)));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: decision === 'approved' ? 'evidence.approve' : 'evidence.reject',
      entityType: 'evidence',
      entityId: ev.id,
      meta: { actionId: ev.actionId, notes },
    });
  });
  revalidatePath('/plan');
  revalidatePath('/');
}
