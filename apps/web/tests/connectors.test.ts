import { beforeAll, describe, expect, it } from 'vitest';
import { describeScopes, matchAiApp, riskFromScopes } from '@/lib/connectors/catalog';
import { decryptSecret, encryptSecret, signState, verifyState } from '@/lib/connectors/crypto';
import { authorizeUrl, discoverEntra, discoverPowerPlatform, exchangeCode, syncMicrosoft } from '@/lib/connectors/microsoft';
import { ROLE_ARN, trustPolicy } from '@/lib/connectors/aws';
import type { Http } from '@/lib/connectors/types';

beforeAll(() => {
  process.env.CONNECTOR_ENC_KEY = 'llave-de-prueba-para-conectores-0123456789';
  process.env.AUTH_SECRET = 'auth-secret-de-prueba-0123456789';
  process.env.MS_CLIENT_ID = '00000000-0000-0000-0000-000000000001';
  process.env.MS_CLIENT_SECRET = 'secreto-de-prueba';
  process.env.ONIX_AWS_ACCOUNT_ID = '999988887777';
});

const TENANT = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const idToken = (claims: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

/** Simula Graph y Power Platform con un directorio pequeño. */
function fakeMicrosoft(opts: { ppStatus?: number } = {}): { http: Http; calls: string[] } {
  const calls: string[] = [];
  const http: Http = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/oauth2/v2.0/token')) {
      const body = new URLSearchParams(String(init?.body));
      if (body.get('grant_type') === 'authorization_code')
        return json({ access_token: 'g1', refresh_token: 'r1', id_token: idToken({ tid: TENANT, preferred_username: 'admin@altamar.mx', name: 'Admin' }) });
      return json({ access_token: body.get('scope')!.includes('powerplatform') ? 'pp' : 'graph', refresh_token: `r-${calls.length}` });
    }
    if (url.includes('/servicePrincipals') && !url.includes('$skiptoken')) {
      return json({
        value: [
          { id: 'sp1', appId: 'app-chatgpt', displayName: 'ChatGPT', publisherName: 'OpenAI', appOwnerOrganizationId: 'openai-tenant', servicePrincipalType: 'Application' },
          { id: 'sp2', appId: 'app-graph', displayName: 'Microsoft Graph', appOwnerOrganizationId: 'f8cdef31-a31e-4b4a-93e4-5f571e91255a', servicePrincipalType: 'Application' },
          { id: 'sp3', appId: 'app-mi', displayName: 'Mi identidad', servicePrincipalType: 'ManagedIdentity' },
        ],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/servicePrincipals?$skiptoken=abc',
      });
    }
    if (url.includes('$skiptoken')) {
      return json({
        value: [
          { id: 'sp4', appId: 'app-otter', displayName: 'Otter.ai', appOwnerOrganizationId: 'otter-tenant', servicePrincipalType: 'Application' },
          { id: 'sp5', appId: 'app-salesforce', displayName: 'Salesforce', appOwnerOrganizationId: 'sf', servicePrincipalType: 'Application' },
        ],
      });
    }
    if (url.includes('oauth2PermissionGrants')) {
      if (url.includes("'sp1'"))
        return json({
          value: [
            { clientId: 'sp1', consentType: 'Principal', principalId: 'u1', scope: 'openid profile User.Read' },
            { clientId: 'sp1', consentType: 'Principal', principalId: 'u2', scope: 'openid profile User.Read offline_access' },
          ],
        });
      return json({ value: [{ clientId: 'sp4', consentType: 'AllPrincipals', principalId: null, scope: 'Calendars.Read OnlineMeetings.Read User.Read' }] });
    }
    if (url.includes('resourcequery')) {
      if (opts.ppStatus) return json({ error: 'Forbidden' }, opts.ppStatus);
      const body = JSON.parse(String(init?.body));
      if (!body.Options.SkipToken)
        return json({ data: [{ name: 'bot-1', 'properties.displayName': 'Vacaciones', 'properties.createdBy': { displayName: 'Laura Méndez' }, 'properties.environmentId': 'env1' }], skipToken: 'p2' });
      return json({ data: [{ name: 'bot-2', 'properties.displayName': 'Encuestas', 'properties.createdBy': 'jorge@altamar.mx' }] });
    }
    return json({}, 404);
  };
  return { http, calls };
}

describe('catálogo de apps de IA', () => {
  it('reconoce apps por nombre o publicador', () => {
    expect(matchAiApp('ChatGPT')?.vendor).toBe('OpenAI');
    expect(matchAiApp('Some Connector', 'Anthropic PBC')?.product).toBe('Claude');
    expect(matchAiApp('Otter.ai Assistant')?.category).toBe('Notas de reuniones');
    expect(matchAiApp('Salesforce')).toBeNull();
    expect(matchAiApp('Gamma Corp Ledger')?.product).toBe('Gamma');
  });
  it('describe permisos en español, sin los básicos y los de escritura primero', () => {
    expect(describeScopes(['openid', 'email', 'User.Read', 'offline_access'])).toEqual([]);
    expect(describeScopes(['User.Read', 'Calendars.Read', 'Mail.Send', 'Calendars.ReadWrite'])).toEqual(['Enviar correo', 'Modificar calendario', 'Leer calendario']);
  });
  it('sugiere riesgo por permisos', () => {
    expect(riskFromScopes(['openid', 'User.Read'], false)).toBe('Bajo');
    expect(riskFromScopes(['Calendars.Read'], false)).toBe('Medio');
    expect(riskFromScopes(['Mail.ReadWrite'], false)).toBe('Alto');
    expect(riskFromScopes(['Files.Read.All'], true)).toBe('Alto');
  });
});

describe('cifrado y estado OAuth', () => {
  it('cifra y descifra; detecta alteraciones', () => {
    const enc = encryptSecret('refresh-token-secreto');
    expect(enc).not.toContain('refresh-token-secreto');
    expect(decryptSecret(enc)).toBe('refresh-token-secreto');
    const parts = enc.split('.');
    parts[3] = Buffer.from('otra cosa').toString('base64url');
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });
  it('firma el estado y rechaza alterado o vencido', () => {
    const st = { orgId: 'o1', userId: 'u1', nonce: 'n1', exp: Date.now() + 60_000 };
    const raw = signState(st);
    expect(verifyState(raw)?.orgId).toBe('o1');
    const [body, sig] = raw.split('.');
    const forged = Buffer.from(JSON.stringify({ ...st, orgId: 'otra' })).toString('base64url');
    expect(verifyState(`${forged}.${sig}`)).toBeNull();
    expect(verifyState(signState({ ...st, exp: Date.now() - 1 }))).toBeNull();
    expect(verifyState(`${body}`)).toBeNull();
  });
});

describe('conector de Microsoft', () => {
  it('arma la URL de autorización con el estado y el permiso de Graph', () => {
    const u = new URL(authorizeUrl('https://app/cb', 'estado123'));
    expect(u.pathname).toContain('/organizations/oauth2/v2.0/authorize');
    expect(u.searchParams.get('state')).toBe('estado123');
    expect(u.searchParams.get('scope')).toContain('https://graph.microsoft.com/.default');
    expect(u.searchParams.get('scope')).toContain('offline_access');
  });

  it('cambia el código por tenant, cuenta y token de actualización', async () => {
    const { http } = fakeMicrosoft();
    const link = await exchangeCode(http, 'code', 'https://app/cb');
    expect(link).toMatchObject({ tenantId: TENANT, account: 'admin@altamar.mx', refreshToken: 'r1' });
  });

  it('descubre apps de IA de terceros en Entra con usuarios y permisos, siguiendo páginas', async () => {
    const { http } = fakeMicrosoft();
    const items = await discoverEntra(http, 'graph', TENANT);
    expect(items.map((i) => i.name).sort()).toEqual(['ChatGPT', 'Otter.ai']);
    const chat = items.find((i) => i.name === 'ChatGPT')!;
    expect(chat.usersCount).toBe(2);
    expect(chat.suggestedRisk).toBe('Bajo');
    expect(chat.details.scopes).toContain('offline_access');
    const otter = items.find((i) => i.name === 'Otter.ai')!;
    expect(otter.usersCount).toBeNull();
    expect(otter.details.orgWide).toBe(true);
    expect(otter.suggestedRisk).toBe('Alto');
  });

  it('lee agentes de Copilot Studio del inventario de Power Platform con paginación', async () => {
    const { http, calls } = fakeMicrosoft();
    const items = await discoverPowerPlatform(http, 'pp');
    expect(items.map((i) => i.name)).toEqual(['Vacaciones', 'Encuestas']);
    expect(items[0]!.ownerName).toBe('Laura Méndez');
    expect(items[1]!.ownerName).toBe('jorge@altamar.mx');
    expect(calls.filter((c) => c.includes('resourcequery'))).toHaveLength(2);
  });

  it('si Power Platform niega acceso, Entra sigue y queda el aviso', async () => {
    const { http } = fakeMicrosoft({ ppStatus: 403 });
    const r = await syncMicrosoft(http, { tenantId: TENANT, refreshToken: 'r0' });
    expect(r.okSources).toEqual(['entra']);
    expect(r.items).toHaveLength(2);
    expect(r.warnings.join(' ')).toMatch(/AI Reader/);
    expect(r.refreshToken).not.toBe('r0');
  });
});

describe('conector de AWS', () => {
  it('valida ARN de rol y arma la política de confianza con ExternalId', () => {
    expect(ROLE_ARN.test('arn:aws:iam::123456789012:role/OnixGovernDiscovery')).toBe(true);
    expect(ROLE_ARN.test('arn:aws:iam::123:role/x')).toBe(false);
    const p = JSON.parse(trustPolicy('onix-abc'));
    expect(p.Statement[0].Principal.AWS).toBe('arn:aws:iam::999988887777:root');
    expect(p.Statement[0].Condition.StringEquals['sts:ExternalId']).toBe('onix-abc');
  });
});
