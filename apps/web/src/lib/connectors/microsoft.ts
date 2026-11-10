import { matchAiApp, riskFromScopes } from './catalog';
import { ConnectorError, type DiscoveredInput, type Http, type SyncResult } from './types';

/**
 * Conector de Microsoft: una app multi-tenant de Entra con permisos delegados de solo lectura.
 * - Graph: Application.Read.All y DelegatedPermissionGrant.Read.All (apps de IA autorizadas).
 * - Power Platform API: ResourceQuery.Resources.Read (agentes de Copilot Studio).
 * Un administrador del cliente inicia sesión una vez; guardamos su token de actualización cifrado.
 */

const LOGIN = 'https://login.microsoftonline.com';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const PPAPI = 'https://api.powerplatform.com';
export const GRAPH_SCOPE = 'https://graph.microsoft.com/.default offline_access';
export const PP_SCOPE = 'https://api.powerplatform.com/.default offline_access';

/** Tenants de Microsoft: sus apps propias no cuentan como apps de terceros. */
const MICROSOFT_TENANTS = new Set(['f8cdef31-a31e-4b4a-93e4-5f571e91255a', '72f988bf-86f1-41af-91ab-2d7cd011db47']);

export function microsoftConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID?.trim() && process.env.MS_CLIENT_SECRET?.trim());
}

function creds() {
  const id = process.env.MS_CLIENT_ID?.trim();
  const secret = process.env.MS_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new ConnectorError('El conector de Microsoft no está configurado en Ónix.', 'Faltan MS_CLIENT_ID y MS_CLIENT_SECRET.');
  return { id, secret };
}

export function authorizeUrl(redirectUri: string, state: string, domainHint?: string): string {
  const { id } = creds();
  const q = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: `${GRAPH_SCOPE} openid profile`,
    state,
    prompt: 'select_account',
  });
  if (domainHint) q.set('domain_hint', domainHint);
  return `${LOGIN}/organizations/oauth2/v2.0/authorize?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenCall(http: Http, tenant: string, body: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = creds();
  const res = await http(`${LOGIN}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    const desc = json.error_description ?? '';
    if (/AADSTS65001|consent/i.test(desc))
      throw new ConnectorError('Falta el consentimiento de un administrador.', 'Pide a un administrador global o de aplicaciones que conecte y marque "Consentir en nombre de la organización".');
    if (/AADSTS700082|AADSTS700084|expired/i.test(desc)) throw new ConnectorError('La conexión con Microsoft venció.', 'Vuelve a conectar Microsoft 365.');
    throw new ConnectorError('Microsoft rechazó la conexión.', desc.split('\r\n')[0]?.slice(0, 200) || json.error);
  }
  return json;
}

export interface MicrosoftLink {
  tenantId: string;
  account: string;
  accountName: string | null;
  refreshToken: string;
}

function decodeIdToken(idToken?: string): Record<string, unknown> {
  if (!idToken) return {};
  try {
    return JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Cambia el código de autorización por un token de actualización. */
export async function exchangeCode(http: Http, code: string, redirectUri: string): Promise<MicrosoftLink> {
  const t = await tokenCall(http, 'organizations', { grant_type: 'authorization_code', code, redirect_uri: redirectUri, scope: `${GRAPH_SCOPE} openid profile` });
  const claims = decodeIdToken(t.id_token);
  const tenantId = String(claims.tid ?? '');
  if (!tenantId || !t.refresh_token) throw new ConnectorError('Microsoft no devolvió los datos de la organización.');
  return {
    tenantId,
    account: String(claims.preferred_username ?? claims.email ?? ''),
    accountName: claims.name ? String(claims.name) : null,
    refreshToken: t.refresh_token,
  };
}

async function accessToken(http: Http, link: { tenantId: string; refreshToken: string }, scope: string) {
  const t = await tokenCall(http, link.tenantId, { grant_type: 'refresh_token', refresh_token: link.refreshToken, scope });
  return { token: t.access_token, refreshToken: t.refresh_token ?? link.refreshToken };
}

async function getJson<T>(http: Http, url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await http(url, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(init?.headers ?? {}) } });
  if (res.status === 401 || res.status === 403) {
    throw new ConnectorError(
      url.startsWith(PPAPI) ? 'Sin acceso al inventario de Power Platform.' : 'Sin acceso al directorio de Entra ID.',
      url.startsWith(PPAPI)
        ? 'La cuenta que conectó necesita el rol AI Reader, Global Reader o Power Platform Administrator.'
        : 'La cuenta que conectó necesita el rol Global Reader o Cloud Application Administrator.',
    );
  }
  if (!res.ok) throw new ConnectorError(`Microsoft respondió ${res.status}.`, (await res.text().catch(() => '')).slice(0, 200));
  return (await res.json()) as T;
}

interface ServicePrincipal {
  id: string;
  appId: string;
  displayName: string;
  appDisplayName?: string | null;
  publisherName?: string | null;
  appOwnerOrganizationId?: string | null;
  servicePrincipalType?: string | null;
  accountEnabled?: boolean;
  verifiedPublisher?: { displayName?: string | null } | null;
}
interface Grant {
  clientId: string;
  consentType: 'AllPrincipals' | 'Principal';
  principalId: string | null;
  scope: string;
}

/** Apps de IA de terceros registradas en el directorio, con cuántas personas las autorizaron. */
export async function discoverEntra(http: Http, token: string, tenantId: string): Promise<DiscoveredInput[]> {
  const sps: ServicePrincipal[] = [];
  let url: string | null =
    `${GRAPH}/servicePrincipals?$select=id,appId,displayName,appDisplayName,publisherName,appOwnerOrganizationId,servicePrincipalType,accountEnabled,verifiedPublisher&$top=999`;
  for (let page = 0; url && page < 50; page++) {
    const r: { value: ServicePrincipal[]; '@odata.nextLink'?: string } = await getJson(http, url, token);
    sps.push(...r.value);
    url = r['@odata.nextLink'] ?? null;
  }

  const out: DiscoveredInput[] = [];
  for (const sp of sps) {
    if (sp.servicePrincipalType && sp.servicePrincipalType !== 'Application') continue;
    if (sp.appOwnerOrganizationId && MICROSOFT_TENANTS.has(sp.appOwnerOrganizationId)) continue;
    const m = matchAiApp(sp.displayName, sp.appDisplayName, sp.publisherName, sp.verifiedPublisher?.displayName);
    if (!m) continue;

    const grants: { value: Grant[] } = await getJson(http, `${GRAPH}/oauth2PermissionGrants?$filter=clientId eq '${sp.id}'`, token);
    const orgWide = grants.value.some((g) => g.consentType === 'AllPrincipals');
    const users = new Set(grants.value.filter((g) => g.consentType === 'Principal' && g.principalId).map((g) => g.principalId));
    const scopes = [...new Set(grants.value.flatMap((g) => g.scope.split(' ').filter(Boolean)))].sort();
    const internal = sp.appOwnerOrganizationId === tenantId;

    out.push({
      source: 'entra',
      externalId: sp.appId,
      kind: 'app',
      name: sp.displayName,
      vendor: m.vendor,
      platform: m.platform,
      ownerName: null,
      usersCount: orgWide ? null : users.size,
      suggestedRisk: riskFromScopes(scopes, orgWide),
      details: {
        category: m.category,
        product: m.product,
        scopes,
        orgWide,
        enabled: sp.accountEnabled !== false,
        verifiedPublisher: sp.verifiedPublisher?.displayName ?? null,
        internal,
      },
    });
  }
  return out;
}

interface PpRow {
  name?: string;
  id?: string;
  location?: string;
  'properties.displayName'?: string;
  'properties.createdAt'?: string;
  'properties.createdBy'?: unknown;
  'properties.ownerId'?: string;
  'properties.environmentId'?: string;
  properties?: Record<string, unknown>;
}

function personName(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return String(o.displayName ?? o.name ?? o.userPrincipalName ?? o.email ?? '') || null;
  }
  return null;
}

/** Agentes de Copilot Studio y del Agent Builder de M365 desde el inventario de Power Platform. */
export async function discoverPowerPlatform(http: Http, token: string): Promise<DiscoveredInput[]> {
  const out: DiscoveredInput[] = [];
  let skipToken = '';
  for (let page = 0; page < 20; page++) {
    const body = {
      TableName: 'PowerPlatformResources',
      Clauses: [
        { $type: 'where', FieldName: 'type', Operator: '==', Values: ["'microsoft.copilotstudio/agents'"] },
        {
          $type: 'project',
          FieldList: ['name', 'location', 'properties.displayName', 'properties.createdAt', 'properties.createdBy', 'properties.ownerId', 'properties.environmentId'],
        },
      ],
      Options: { Top: 1000, Skip: 0, SkipToken: skipToken },
    };
    const r: { data?: PpRow[]; skipToken?: string } = await getJson(http, `${PPAPI}/resourcequery/resources/query?api-version=2024-10-01`, token, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    for (const row of r.data ?? []) {
      const id = row.name ?? row.id;
      if (!id) continue;
      const p = row.properties ?? {};
      out.push({
        source: 'powerplatform',
        externalId: id,
        kind: 'agente',
        name: String(row['properties.displayName'] ?? p.displayName ?? id),
        vendor: 'Microsoft',
        platform: 'copilot_studio',
        ownerName: personName(row['properties.createdBy'] ?? p.createdBy),
        usersCount: null,
        suggestedRisk: null,
        details: {
          environmentId: row['properties.environmentId'] ?? p.environmentId ?? null,
          location: row.location ?? null,
          createdAt: row['properties.createdAt'] ?? p.createdAt ?? null,
        },
      });
    }
    if (!r.skipToken) break;
    skipToken = r.skipToken;
  }
  return out;
}

/** Corre ambas fuentes; si una falla, la otra sigue y se reporta el aviso. */
export async function syncMicrosoft(
  http: Http,
  link: { tenantId: string; refreshToken: string },
  sources: string[] = ['entra', 'powerplatform'],
): Promise<SyncResult & { refreshToken: string }> {
  const items: DiscoveredInput[] = [];
  const okSources: SyncResult['okSources'] = [];
  const warnings: string[] = [];
  let refreshToken = link.refreshToken;

  const graph = await accessToken(http, { tenantId: link.tenantId, refreshToken }, GRAPH_SCOPE);
  refreshToken = graph.refreshToken;
  if (sources.includes('entra')) {
    try {
      items.push(...(await discoverEntra(http, graph.token, link.tenantId)));
      okSources.push('entra');
    } catch (e) {
      warnings.push(e instanceof ConnectorError ? `${e.message} ${e.hint ?? ''}`.trim() : 'No se pudo leer Entra ID.');
    }
  }

  if (sources.includes('powerplatform')) {
    try {
      const pp = await accessToken(http, { tenantId: link.tenantId, refreshToken }, PP_SCOPE);
      refreshToken = pp.refreshToken;
      items.push(...(await discoverPowerPlatform(http, pp.token)));
      okSources.push('powerplatform');
    } catch (e) {
      warnings.push(e instanceof ConnectorError ? `${e.message} ${e.hint ?? ''}`.trim() : 'No se pudo leer Power Platform.');
    }
  }
  return { items, okSources, warnings, refreshToken };
}
