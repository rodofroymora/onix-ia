'use server';

import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { memberships, passwordResets, userInvites, users } from '@onix/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appendAudit } from '@/lib/audit';
import { hashPassword, newToken, orgFromToken, orgPrefix, passwordProblem, tokenHash } from '@/lib/auth/passwords';
import { getDb, withOrg } from '@/lib/db';
import { appBaseUrl, sendEmail } from '@/lib/notify';
import { isRateLimited, recordFailure } from '@/lib/rate-limit';
import { findInvite } from '@/lib/server/invites';
import { requireWriteAccess } from '@/lib/session';

const INVITE_DAYS = 7;
const ROLES = ['admin', 'viewer'] as const;

export interface InviteUserState {
  ok: boolean;
  message: string;
  link?: string;
}

/** Invitar a una persona a la organización (administración o solo lectura; consultor solo lo invita otro consultor). */
export async function inviteUserAction(_prev: InviteUserState | null, formData: FormData): Promise<InviteUserState> {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim().slice(0, 120) || null;
  const roleRaw = String(formData.get('role') ?? 'admin');
  const asConsultant = roleRaw === 'consultor' && session.user.role === 'consultant';
  const role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as (typeof ROLES)[number]) : 'admin';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Revisa el correo.' };
  if (session.user.role === 'client_reader') return { ok: false, message: 'No tienes permiso para invitar.' };

  const { db } = getDb();
  const [existing] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  if (existing?.passwordHash) {
    const already = await withOrg(db, orgId, (tx) =>
      tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, existing.id), eq(memberships.organizationId, orgId))).limit(1),
    );
    if (already.length) return { ok: false, message: 'Esa persona ya tiene acceso.' };
  }

  const { token, hash } = newToken(orgPrefix(orgId));
  await withOrg(db, orgId, async (tx) => {
    await tx.insert(userInvites).values({
      organizationId: orgId,
      email,
      name,
      role: asConsultant ? 'owner' : role,
      asConsultant,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      invitedBy: session.user.id,
    });
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'user.invite',
      entityType: 'user_invite',
      meta: { email, role: asConsultant ? 'consultor' : role },
    });
  });

  const link = `${await appBaseUrl()}/invitacion/${token}`;
  let sent = 'skipped';
  try {
    sent = await sendEmail({
      to: email,
      subject: `Tu acceso a Ónix Govern · ${session.user.organizationName}`,
      paragraphs: [
        name ? `Hola, ${name.split(' ')[0]}:` : 'Hola:',
        `${session.user.name} te invitó a Ónix Govern para trabajar el gobierno de IA de ${session.user.organizationName}.`,
        'Entra con el botón, crea tu contraseña y listo.',
      ],
      cta: { label: 'Crear mi acceso', href: link },
      footnote: `El enlace es personal y vence en ${INVITE_DAYS} días.`,
    });
  } catch (err) {
    console.error('[usuarios] no salió el correo de invitación', err);
  }
  revalidatePath('/organizacion');
  return sent === 'sent'
    ? { ok: true, message: `Invitación enviada a ${email}.`, link }
    : { ok: true, message: 'Invitación creada. El correo no está configurado: comparte este enlace con la persona.', link };
}

export async function revokeInviteAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = String(formData.get('inviteId') ?? '');
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx.delete(userInvites).where(and(eq(userInvites.id, id), eq(userInvites.organizationId, session.user.organizationId), isNull(userInvites.acceptedAt)));
  });
  revalidatePath('/organizacion');
}

export interface AcceptState {
  ok: boolean;
  message: string;
}

/** La persona invitada crea su contraseña; queda como miembro de la organización. */
export async function acceptInviteAction(_prev: AcceptState | null, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get('token') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (await isRateLimited(`invite:${tokenHash(token).slice(0, 16)}`)) return { ok: false, message: 'Demasiados intentos; espera unos minutos.' };
  const inv = await findInvite(token);
  if (!inv) {
    await recordFailure(`invite:${tokenHash(token).slice(0, 16)}`);
    return { ok: false, message: 'La invitación no existe o ya venció.' };
  }
  if (!name) return { ok: false, message: 'Escribe tu nombre.' };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, message: problem };
  if (password !== confirm) return { ok: false, message: 'Las contraseñas no coinciden.' };

  const passwordHash = await hashPassword(password);
  const { db } = getDb();
  await withOrg(db, inv.organizationId, async (tx) => {
    const [found] = await tx.select().from(users).where(eq(users.email, inv.email)).limit(1);
    let userId = found?.id;
    if (found) {
      await tx
        .update(users)
        .set({ name, passwordHash, defaultOrganizationId: inv.organizationId, isConsultant: found.isConsultant || inv.asConsultant, updatedAt: new Date() })
        .where(eq(users.id, found.id));
    } else {
      const [row] = await tx
        .insert(users)
        .values({ email: inv.email, name, passwordHash, defaultOrganizationId: inv.organizationId, isConsultant: inv.asConsultant })
        .returning();
      userId = row!.id;
    }
    await tx
      .insert(memberships)
      .values({ organizationId: inv.organizationId, userId: userId!, role: inv.role })
      .onConflictDoUpdate({ target: [memberships.organizationId, memberships.userId], set: { role: inv.role, updatedAt: new Date() } });
    await tx.update(userInvites).set({ acceptedAt: new Date() }).where(eq(userInvites.id, inv.id));
    await appendAudit(tx, {
      organizationId: inv.organizationId,
      actorUserId: userId!,
      action: 'user.invite_accepted',
      entityType: 'user',
      entityId: userId!,
    });
  });
  redirect(`/login?bienvenido=1&correo=${encodeURIComponent(inv.email)}`);
}

/** Pide el enlace para crear una contraseña nueva. Siempre responde igual, exista o no la cuenta. */
export async function requestPasswordResetAction(_prev: AcceptState | null, formData: FormData): Promise<AcceptState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const generic: AcceptState = { ok: true, message: 'Si el correo tiene cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Revisa el correo.' };
  if (await isRateLimited(`reset:${email}`)) return generic;
  await recordFailure(`reset:${email}`);
  const { db } = getDb();
  const [u] = await db.select({ id: users.id, name: users.name, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  if (!u?.passwordHash) return generic;
  const { token, hash } = newToken();
  await db.insert(passwordResets).values({ userId: u.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  try {
    await sendEmail({
      to: email,
      subject: 'Crea una contraseña nueva · Ónix Govern',
      paragraphs: [`Hola, ${u.name.split(' ')[0]}:`, 'Recibimos una solicitud para cambiar tu contraseña. Si no fuiste tú, ignora este correo.'],
      cta: { label: 'Crear contraseña nueva', href: `${await appBaseUrl()}/recuperar/${token}` },
      footnote: 'El enlace vence en una hora y solo funciona una vez.',
    });
  } catch (err) {
    console.error('[usuarios] no salió el correo de recuperación', err);
  }
  return generic;
}

export async function resetPasswordAction(_prev: AcceptState | null, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const problem = passwordProblem(password);
  if (problem) return { ok: false, message: problem };
  if (password !== confirm) return { ok: false, message: 'Las contraseñas no coinciden.' };
  const { db } = getDb();
  const [r] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .orderBy(desc(passwordResets.createdAt))
    .limit(1);
  if (!r) return { ok: false, message: 'El enlace no es válido o ya venció. Pide uno nuevo.' };
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, r.userId)).limit(1);
  await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, r.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
  redirect(`/login?cambio=1&correo=${encodeURIComponent(u?.email ?? '')}`);
}
