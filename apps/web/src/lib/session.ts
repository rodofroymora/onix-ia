import { redirect } from 'next/navigation';
import { auth } from './auth';
import type { AppRole } from './demo-users';
import { canWrite, isConsultant } from './demo-users';

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) {
    redirect('/login');
  }
  return session;
}

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
