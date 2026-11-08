import { and, eq } from 'drizzle-orm';
import { memberships, organizations, users } from '@onix/db';
import { getDb, withOrg } from '../db';
import type { AppRole } from '../demo-users';
import { verifyPassword } from './passwords';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  organizationId: string;
  organizationName: string;
}

/** Rol de la app a partir del rol en la organización (el consultor de Ónix manda sobre todo). */
export function appRoleFor(membershipRole: string, isConsultant: boolean): AppRole {
  if (isConsultant) return 'consultant';
  return membershipRole === 'viewer' ? 'client_reader' : 'client_admin';
}

/** Usuario real con contraseña propia. */
export async function loadRealUser(email: string, password: string): Promise<AuthUser | null> {
  const { db } = getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u?.passwordHash || !(await verifyPassword(password, u.passwordHash))) return null;
  const orgId = u.defaultOrganizationId;
  if (!orgId) return null;
  const [org] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;
  const [m] = await withOrg(db, org.id, (tx) =>
    tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, u.id), eq(memberships.organizationId, org.id)))
      .limit(1),
  );
  if (!m && !u.isConsultant) return null;
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  return { id: u.id, email: u.email, name: u.name, role: appRoleFor(m?.role ?? 'viewer', u.isConsultant), organizationId: org.id, organizationName: org.name };
}
