'use server';

import { createHash, randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { aiUsageMetrics, organizations } from '@onix/db';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

const int = (v: FormDataEntryValue | null, max = 1_000_000_000) => {
  const n = Math.round(Number(String(v ?? '').replace(/[^0-9.]/g, '')));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};

/** Captura manual del uso de una herramienta en un mes (reemplaza el registro si ya existía). */
export async function saveUsageAction(formData: FormData) {
  const session = await requireWriteAccess();
  const month = String(formData.get('month') ?? '');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Mes inválido');
  const tool = String(formData.get('tool') ?? '').trim().slice(0, 120);
  if (!tool) throw new Error('Herramienta requerida');
  const values = {
    organizationId: session.user.organizationId,
    period: `${month}-01`,
    tool,
    activeUsers: int(formData.get('activeUsers'), 1_000_000),
    requests: int(formData.get('requests')),
    costMxn: int(formData.get('costMxn')),
    incidents: int(formData.get('incidents'), 10_000),
    sanctioned: formData.get('sanctioned') === 'on',
    source: 'manual',
  };
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx
      .insert(aiUsageMetrics)
      .values(values)
      .onConflictDoUpdate({
        target: [aiUsageMetrics.organizationId, aiUsageMetrics.period, aiUsageMetrics.tool],
        set: {
          activeUsers: values.activeUsers,
          requests: values.requests,
          costMxn: values.costMxn,
          incidents: values.incidents,
          sanctioned: values.sanctioned,
          source: 'manual',
        },
      });
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'telemetry.manual',
      entityType: 'ai_usage_metric',
      meta: { month, tool },
    });
  });
  revalidatePath('/telemetria');
  revalidatePath('/');
}

/** Genera (o rota) la clave para mandar telemetría por API. Se muestra una sola vez. */
export async function generateIngestKeyAction(): Promise<{ key: string }> {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const key = `onx_${orgId.replace(/-/g, '')}_${randomBytes(24).toString('base64url')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    await tx.update(organizations).set({ ingestKeyHash: hash, updatedAt: sql`now()` }).where(eq(organizations.id, orgId));
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'telemetry.key_rotated',
      entityType: 'organization',
      entityId: orgId,
    });
  });
  revalidatePath('/telemetria');
  return { key };
}
