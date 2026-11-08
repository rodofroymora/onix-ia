import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { organizations } from '@onix/db';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { getDb } from './db';
import type { AppRole } from './demo-users';
import { canWrite, isConsultant } from './demo-users';

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) {
    redirect('/login');
  }
  // Si la organización ya no existe (por ejemplo, se volvió a sembrar la demo), pedir login de nuevo.
  if (!(await organizationExists(session.user.organizationId))) {
    redirect('/login?expirada=1');
  }
  return session;
}

export const organizationExists = cache(async (id: string) => {
  const { db } = getDb();
  const rows = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows.length > 0;
});

export async function requireRole(allowed: AppRole[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) {
    redirect('/');
  }
  return session;
}

export async function requireWriteAccess() {
  const session = await requireSession();
  if (!canWrite(session.user.role)) {
    redirect('/');
  }
  return session;
}

export async function requireConsultant() {
  const session = await requireSession();
  if (!isConsultant(session.user.role)) {
    redirect('/');
  }
  return session;
}

export { canWrite, isConsultant };
