import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { organizations } from '@onix/db';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordForm } from '@/components/auth/PasswordForm';
import { acceptInviteAction } from '@/lib/actions/users';
import { getDb } from '@/lib/db';
import { findInvite } from '@/lib/server/invites';

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findInvite(decodeURIComponent(token));
  if (!inv) {
    return (
      <AuthShell title="Invitación no disponible" subtitle="El enlace no existe, ya se usó o venció.">
        <p className="text-center text-[13px] text-ink-muted">
          Pide a quien te invitó que te mande uno nuevo, o <Link href="/login" className="text-accent hover:underline">entra con tu cuenta</Link>.
        </p>
      </AuthShell>
    );
  }
  const { db } = getDb();
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, inv.organizationId)).limit(1);
  return (
    <AuthShell title="Crea tu acceso" subtitle={`${org?.name ?? 'Ónix Govern'} · ${inv.email}`}>
      <PasswordForm action={acceptInviteAction} token={decodeURIComponent(token)} withName defaultName={inv.name ?? ''} submitLabel="Crear mi acceso" />
    </AuthShell>
  );
}
