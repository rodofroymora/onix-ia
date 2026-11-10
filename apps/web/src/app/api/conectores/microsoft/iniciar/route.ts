import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signState } from '@/lib/connectors/crypto';
import { authorizeUrl, microsoftConfigured } from '@/lib/connectors/microsoft';
import { appBaseUrl } from '@/lib/notify';
import { requireWriteAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Manda al administrador del cliente a iniciar sesión en Microsoft para autorizar la lectura. */
export async function GET() {
  const session = await requireWriteAccess();
  const base = await appBaseUrl();
  if (!microsoftConfigured()) return NextResponse.redirect(`${base}/organizacion?conector=microsoft&error=config`);
  const nonce = randomBytes(16).toString('hex');
  const state = signState({ orgId: session.user.organizationId, userId: session.user.id, nonce, exp: Date.now() + 10 * 60_000 });
  const res = NextResponse.redirect(authorizeUrl(`${base}/api/conectores/microsoft/callback`, state));
  res.cookies.set('onix_ms_nonce', nonce, { httpOnly: true, secure: base.startsWith('https'), sameSite: 'lax', path: '/api/conectores', maxAge: 600 });
  return res;
}
