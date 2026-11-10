import { and, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { connectors } from '@onix/db';
import { appendAudit } from '@/lib/audit';
import { encryptionReady, encryptSecret, verifyState } from '@/lib/connectors/crypto';
import { exchangeCode } from '@/lib/connectors/microsoft';
import { runConnector } from '@/lib/connectors/sync';
import { ConnectorError } from '@/lib/connectors/types';
import { getDb, withOrg } from '@/lib/db';
import { appBaseUrl } from '@/lib/notify';
import { requireWriteAccess } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Regreso de Microsoft: valida el estado, guarda la conexión cifrada y corre la primera sincronización. */
export async function GET(req: NextRequest) {
  const session = await requireWriteAccess();
  const base = await appBaseUrl();
  const back = (q: string) => {
    const res = NextResponse.redirect(`${base}/organizacion?conector=microsoft&${q}#conectores`);
    res.cookies.delete({ name: 'onix_ms_nonce', path: '/api/conectores' });
    return res;
  };
  const p = req.nextUrl.searchParams;
  if (p.get('error')) return back(`error=${p.get('error') === 'access_denied' ? 'cancelado' : 'microsoft'}`);

  const st = verifyState(p.get('state') ?? '');
  const nonce = req.cookies.get('onix_ms_nonce')?.value;
  if (!st || !nonce || st.nonce !== nonce || st.orgId !== session.user.organizationId || st.userId !== session.user.id) return back('error=estado');
  if (!encryptionReady()) return back('error=llave');

  const code = p.get('code');
  if (!code) return back('error=microsoft');
  try {
    const link = await exchangeCode(fetch, code, `${base}/api/conectores/microsoft/callback`);
    const orgId = session.user.organizationId;
    const { db } = getDb();
    const row = await withOrg(db, orgId, async (tx) => {
      const values = {
        status: 'conectado',
        displayName: link.account || link.tenantId,
        config: { tenantId: link.tenantId, account: link.account, accountName: link.accountName },
        secretEnc: encryptSecret(link.refreshToken),
        lastError: null,
        updatedAt: new Date(),
      };
      const [prev] = await tx.select().from(connectors).where(and(eq(connectors.organizationId, orgId), eq(connectors.provider, 'microsoft'))).limit(1);
      const [saved] = prev
        ? await tx.update(connectors).set(values).where(eq(connectors.id, prev.id)).returning()
        : await tx.insert(connectors).values({ ...values, organizationId: orgId, provider: 'microsoft', createdBy: session.user.id }).returning();
      await appendAudit(tx, {
        organizationId: orgId,
        actorUserId: session.user.id,
        action: 'connector.connect',
        entityType: 'connector',
        entityId: saved!.id,
        meta: { provider: 'microsoft', tenantId: link.tenantId },
      });
      return saved!;
    });
    const r = await runConnector(orgId, row, session.user.id);
    return back(r.ok ? `ok=1&nuevos=${r.added}` : 'error=sync');
  } catch (e) {
    if (!(e instanceof ConnectorError)) console.error('[conectores] callback de Microsoft falló', e);
    return back(`error=${e instanceof ConnectorError && /consentimiento/.test(e.message) ? 'consentimiento' : 'microsoft'}`);
  }
}
