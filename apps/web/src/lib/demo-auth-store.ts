import { and, eq } from 'drizzle-orm';
import { memberships, organizations, users } from '@onix/db';
import { getDb, withOrg } from './db';
import type { AppRole } from './demo-users';
import { findDemoUser } from './demo-users';
import { tryEnsureDemoReady } from './ensure-demo';

const DEMO_ORG_SLUG = 'grupo-altamar';

export interface DemoAuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  organizationId: string;
  organizationName: string;
}

/**
 * Valida credenciales demo y resuelve usuario y organización desde la base.
 * (Antes leía un snapshot en .data/demo-auth.json, que no existe en el host de publish.)
 */
export async function loadDemoAuthUser(email: string, password: string): Promise<DemoAuthUser | null> {
  const demo = findDemoUser(email, password);
  if (!demo) return null;

  if (!(await tryEnsureDemoReady())) return null;

  const { db } = getDb();
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, DEMO_ORG_SLUG))
    .limit(1);
  if (!org) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, demo.email))
    .limit(1);
  if (!user) return null;

  const member = await withOrg(db, org.id, (tx) =>
    tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.organizationId, org.id)))
      .limit(1),
  );
  if (member.length === 0) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? demo.name,
    role: demo.role,
    organizationId: org.id,
    organizationName: org.name,
  };
}
