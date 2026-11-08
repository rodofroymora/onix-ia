'use server';

import { and, eq } from 'drizzle-orm';
import { actions, evidences, plans, stages } from '@onix/db';
import { resolveActionProgress } from '@onix/engine';
import { ACTION_LIBRARY } from '@onix/templates';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

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
    for (const tpl of ACTION_LIBRARY) {
      const stage = stageRows.find((s) => s.name === tpl.stage) ?? stageRows[0];
      if (!stage) continue;
      await tx.insert(actions).values({
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

/** CU-12: progreso 0/25/50/75/100 con compuerta de evidencia. */
export async function updateActionProgressAction(formData: FormData) {
  const session = await requireWriteAccess();
  const actionId = String(formData.get('actionId') ?? '');
  const claimed = Number(formData.get('progress') ?? 0);
  const evidenceStatus = String(formData.get('evidenceStatus') ?? 'none') as
    | 'none'
    | 'pending'
    | 'approved'
    | 'rejected';

  const resolved = resolveActionProgress({ claimed: claimed as 0 | 25 | 50 | 75 | 100, evidenceStatus });
  if (!resolved) throw new Error('Progreso inválido');

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx
      .update(actions)
      .set({ progress: String(resolved.progress) as '0' | '25' | '50' | '75' | '100', updatedAt: new Date() })
      .where(and(eq(actions.id, actionId), eq(actions.organizationId, session.user.organizationId)));

    if (evidenceStatus !== 'none') {
      const existing = await tx.select().from(evidences).where(eq(evidences.actionId, actionId)).limit(1);
      if (existing[0]) {
        await tx
          .update(evidences)
          .set({ status: evidenceStatus, updatedAt: new Date() })
          .where(eq(evidences.id, existing[0].id));
      } else {
        await tx.insert(evidences).values({
          organizationId: session.user.organizationId,
          actionId,
          status: evidenceStatus,
          label: 'Evidencia de cierre',
        });
      }
    }

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'action.progress',
      entityType: 'action',
      entityId: actionId,
      meta: { claimed, resolved: resolved.progress, blockedClose: resolved.blockedClose, reason: resolved.reason },
    });
  });

  revalidatePath('/plan');
}
