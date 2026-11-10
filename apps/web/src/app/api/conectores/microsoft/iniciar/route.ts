import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { signState } from '@/lib/connectors/crypto';
import { authorizeUrl, microsoftConfigured } from '@/lib/connectors/microsoft';
import { MS_SOURCES } from '@/lib/connectors/integrations';
import { appBaseUrl } from '@/lib/notify';
import { requireWriteAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Manda al administrador del cliente a iniciar sesión en Microsoft para autorizar la lectura. */
/** Recibe las fuentes elegidas y el dominio (opcional) desde el formulario de la integración. */
export async function GET(req: NextRequest) {
  const session = await requireWriteAccess();
  const base = await appBaseUrl();
  if (!microsoftConfigured()) return NextResponse.redirect(`${base}/agentes?tab=conexiones&integracion=microsoft&error=config`);
  const valid = MS_SOURCES.map((s) => s.k);
  const sources = (req.nextUrl.searchParams.getAll('sources').length ? req.nextUrl.searchParams.getAll('sources') : valid).filter((s) => valid.includes(s));
  if (!sources.length) return NextResponse.redirect(`${base}/agentes?tab=conexiones&integracion=microsoft&error=fuentes`);
  const domain = (req.nextUrl.searchParams.get('domain') ?? '').trim().toLowerCase();
  const domainHint = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : undefined;
  const nonce = randomBytes(16).toString('hex');
  const state = signState({ orgId: session.user.organizationId, userId: session.user.id, nonce, exp: Date.now() + 10 * 60_000, sources });
  const res = NextResponse.redirect(authorizeUrl(`${base}/api/conectores/microsoft/callback`, state, domainHint));
  res.cookies.set('onix_ms_nonce', nonce, { httpOnly: true, secure: base.startsWith('https'), sameSite: 'lax', path: '/api/conectores', maxAge: 600 });
  return res;
}
