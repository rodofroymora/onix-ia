'use server';

import { and, eq } from 'drizzle-orm';
import { aiAgents, connectors, discoveredItems } from '@onix/db';
import { AGENT_PLATFORMS } from '@onix/templates';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appendAudit } from '@/lib/audit';
import { AWS_REGIONS, ROLE_ARN, newExternalId } from '@/lib/connectors/aws';
import { runConnector } from '@/lib/connectors/sync';
import { MS_SOURCES } from '@/lib/connectors/integrations';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/;

function refresh() {
  revalidatePath('/organizacion');
  revalidatePath('/agentes');
  revalidatePath('/');
}

/** Crea la conexión de AWS en espera, con su ExternalId, para que el cliente cree el rol. */
export async function prepareAwsAction() {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    const [prev] = await tx.select().from(connectors).where(and(eq(connectors.organizationId, orgId), eq(connectors.provider, 'aws'))).limit(1);
    if (prev) return;
    await tx.insert(connectors).values({
      organizationId: orgId,
      provider: 'aws',
      status: 'pendiente',
      config: { externalId: newExternalId(), regions: ['us-east-1'] },
      createdBy: session.user.id,
    });
  });
  refresh();
  redirect('/agentes?tab=conexiones&integracion=aws');
}

export async function saveAwsAction(_prev: { ok: boolean; message: string } | null, fd: FormData): Promise<{ ok: boolean; message: string }> {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const roleArn = String(fd.get('roleArn') ?? '').trim();
  const regions = fd.getAll('regions').map(String).filter((r) => AWS_REGIONS.includes(r));
  if (!ROLE_ARN.test(roleArn)) return { ok: false, message: 'El ARN debe verse como arn:aws:iam::123456789012:role/OnixGovernDiscovery.' };
  if (!regions.length) return { ok: false, message: 'Elige al menos una región.' };
  const { db } = getDb();
  const row = await withOrg(db, orgId, async (tx) => {
    const [prev] = await tx.select().from(connectors).where(and(eq(connectors.organizationId, orgId), eq(connectors.provider, 'aws'))).limit(1);
    if (!prev) return null;
    const cfg = prev.config as { externalId: string };
    const [saved] = await tx
      .update(connectors)
      .set({ config: { externalId: cfg.externalId, roleArn, regions }, displayName: `Cuenta ${roleArn.split(':')[4]}`, status: 'conectado', updatedAt: new Date() })
      .where(eq(connectors.id, prev.id))
      .returning();
    await appendAudit(tx, { organizationId: orgId, actorUserId: session.user.id, action: 'connector.connect', entityType: 'connector', entityId: prev.id, meta: { provider: 'aws', regions } });
    return saved!;
  });
  if (!row) return { ok: false, message: 'Primero prepara la conexión con AWS.' };
  const r = await runConnector(orgId, row, session.user.id);
  refresh();
  return r.ok
    ? { ok: true, message: `Conectado. Encontramos ${r.found} ${r.found === 1 ? 'agente' : 'agentes'}${r.added ? `, ${r.added} nuevos` : ''}.` }
    : { ok: false, message: r.message };
}

export async function syncConnectorAction(fd: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const id = String(fd.get('connectorId') ?? '');
  if (!UUID.test(id)) return;
  const { db } = getDb();
  const [row] = await withOrg(db, orgId, (tx) => tx.select().from(connectors).where(and(eq(connectors.id, id), eq(connectors.organizationId, orgId))).limit(1));
  if (!row) return;
  const r = await runConnector(orgId, row, session.user.id);
  refresh();
  redirect(`/agentes?tab=conexiones&integracion=${row.provider}&${r.ok ? `ok=1&nuevos=${r.added}` : 'error=sync'}`);
}

/** Quita la conexión y sus credenciales. Los agentes ya registrados se quedan. */
export async function disconnectConnectorAction(fd: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const id = String(fd.get('connectorId') ?? '');
  if (!UUID.test(id)) return;
  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    const [row] = await tx.select().from(connectors).where(and(eq(connectors.id, id), eq(connectors.organizationId, orgId))).limit(1);
    if (!row) return;
    await tx.delete(connectors).where(eq(connectors.id, id));
    await appendAudit(tx, { organizationId: orgId, actorUserId: session.user.id, action: 'connector.disconnect', entityType: 'connector', entityId: id, meta: { provider: row.provider } });
  });
  refresh();
  redirect('/agentes?tab=conexiones');
}

/** Cambia qué revisa el conector de Microsoft sin volver a iniciar sesión. */
export async function saveMicrosoftSourcesAction(fd: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const valid = MS_SOURCES.map((x) => x.k);
  const sources = fd.getAll('sources').map(String).filter((x) => valid.includes(x));
  if (!sources.length) redirect('/agentes?tab=conexiones&integracion=microsoft&error=fuentes');
  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    const [row] = await tx.select().from(connectors).where(and(eq(connectors.organizationId, orgId), eq(connectors.provider, 'microsoft'))).limit(1);
    if (!row) return;
    await tx.update(connectors).set({ config: { ...(row.config as object), sources }, updatedAt: new Date() }).where(eq(connectors.id, row.id));
    await appendAudit(tx, { organizationId: orgId, actorUserId: session.user.id, action: 'connector.update', entityType: 'connector', entityId: row.id, meta: { sources } });
  });
  refresh();
  redirect('/agentes?tab=conexiones&integracion=microsoft&guardado=1');
}

const DATA_FROM_SCOPE: [RegExp, string][] = [
  [/^Mail\./i, 'Correo'],
  [/^(Files|Sites)\./i, 'Archivos de OneDrive y SharePoint'],
  [/^Calendars\./i, 'Calendario'],
  [/^(Chat|ChannelMessage)\./i, 'Chats de Teams'],
  [/^OnlineMeeting/i, 'Reuniones'],
  [/^Contacts\./i, 'Contactos'],
  [/^(Directory\.|User\.Read\.All)/i, 'Directorio de personas'],
];

/** Convierte una detección en un agente del registro. */
export async function registerDiscoveredAction(fd: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const id = String(fd.get('itemId') ?? '');
  if (!UUID.test(id)) return;
  const { db } = getDb();
  const agentId = await withOrg(db, orgId, async (tx) => {
    const [it] = await tx.select().from(discoveredItems).where(and(eq(discoveredItems.id, id), eq(discoveredItems.organizationId, orgId))).limit(1);
    if (!it) return null;
    if (it.agentId) return it.agentId;
    const d = it.details as { scopes?: string[]; category?: string; region?: string; orgWide?: boolean; description?: string | null };
    const scopes = d.scopes ?? [];
    const dataSources = [...new Set(DATA_FROM_SCOPE.filter(([re]) => scopes.some((s) => re.test(s))).map(([, n]) => n))];
    const isApp = it.kind === 'app';
    const platform = AGENT_PLATFORMS.some((p) => p.k === it.platform) ? it.platform! : isApp ? 'saas_ia' : 'custom';
    const description =
      d.description ||
      (isApp
        ? `${d.category ?? 'App de IA'} detectada en Entra ID. ${d.orgWide ? 'Autorizada para toda la organización.' : `${it.usersCount ?? 0} personas la autorizaron con su cuenta.`}`
        : `Detectado en ${it.source === 'powerplatform' ? 'Copilot Studio' : `AWS${d.region ? ` (${d.region})` : ''}`}.`);
    const [agent] = await tx
      .insert(aiAgents)
      .values({
        organizationId: orgId,
        name: it.name,
        description: description.slice(0, 1000),
        platform,
        publisher: isApp ? 'Terceros' : 'Organización',
        channel: it.source === 'powerplatform' ? 'Teams' : isApp ? 'Web' : 'API',
        ownerName: it.ownerName,
        status: 'En producción',
        risk: it.suggestedRisk ?? 'Medio',
        managed: !isApp,
        dataSources,
        capabilities: [],
        monthlyUsers: it.usersCount ?? 0,
        origin: 'descubierto',
      })
      .returning();
    await tx.update(discoveredItems).set({ status: 'registrado', agentId: agent!.id, updatedAt: new Date() }).where(eq(discoveredItems.id, id));
    await appendAudit(tx, { organizationId: orgId, actorUserId: session.user.id, action: 'discovery.register', entityType: 'ai_agent', entityId: agent!.id, meta: { source: it.source, externalId: it.externalId } });
    return agent!.id;
  });
  refresh();
  if (agentId) redirect(`/agentes?agente=${agentId}`);
}

/** Liga una detección con un agente que ya estaba registrado a mano. */
export async function linkDiscoveredAction(fd: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const id = String(fd.get('itemId') ?? '');
  const agentId = String(fd.get('agentId') ?? '');
  if (!UUID.test(id) || !UUID.test(agentId)) return;
  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    const [a] = await tx.select({ id: aiAgents.id }).from(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizationId, orgId))).limit(1);
    if (!a) return;
    await tx
      .update(discoveredItems)
      .set({ status: 'registrado', agentId, updatedAt: new Date() })
      .where(and(eq(discoveredItems.id, id), eq(discoveredItems.organizationId, orgId)));
    await appendAudit(tx, { organizationId: orgId, actorUserId: session.user.id, action: 'discovery.link', entityType: 'ai_agent', entityId: agentId, meta: { itemId: id } });
  });
  refresh();
}

export async function setDiscoveredStatusAction(fd: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const id = String(fd.get('itemId') ?? '');
  const to = String(fd.get('to') ?? '');
  if (!UUID.test(id) || !['ignorado', 'nuevo'].includes(to)) return;
  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    await tx
      .update(discoveredItems)
      .set({ status: to, ...(to === 'nuevo' ? { agentId: null } : {}), updatedAt: new Date() })
      .where(and(eq(discoveredItems.id, id), eq(discoveredItems.organizationId, orgId)));
    await appendAudit(tx, { organizationId: orgId, actorUserId: session.user.id, action: `discovery.${to === 'ignorado' ? 'ignore' : 'restore'}`, entityType: 'discovered_item', entityId: id });
  });
  refresh();
}
