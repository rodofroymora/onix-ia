import { auditLogs } from '@onix/db';
import type { GovernTx } from '@onix/db';

export async function appendAudit(
  tx: GovernTx,
  input: {
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    meta: input.meta ?? {},
  });
}
