import { and, eq, gt, isNull } from 'drizzle-orm';
import { userInvites } from '@onix/db';
import { orgFromToken, tokenHash } from '@/lib/auth/passwords';
import { getDb, withOrg } from '@/lib/db';

/** Lee una invitación vigente a partir del enlace (sin sesión). */
export async function findInvite(token: string) {
  const orgId = orgFromToken(token);
  if (!orgId) return null;
  const { db } = getDb();
  const [inv] = await withOrg(db, orgId, (tx) =>
    tx
      .select()
      .from(userInvites)
      .where(and(eq(userInvites.tokenHash, tokenHash(token)), eq(userInvites.organizationId, orgId), isNull(userInvites.acceptedAt), gt(userInvites.expiresAt, new Date())))
      .limit(1),
  );
  return inv ?? null;
}

