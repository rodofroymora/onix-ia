import { eq } from 'drizzle-orm';
import type { GovernTx } from './client.js';
import * as schema from './schema/index.js';

/**
 * Conectores de ejemplo para la demo de Grupo Altamar: muestran lo que Ónix detecta en
 * Microsoft 365 (apps de IA autorizadas y agentes de Copilot Studio) y en AWS.
 * Es idempotente: si la organización ya tiene conectores, no hace nada.
 */
type Item = {
  source: 'entra' | 'powerplatform' | 'bedrock' | 'agentcore';
  id: string;
  kind: 'app' | 'agente';
  name: string;
  vendor: string;
  platform: string;
  owner?: string;
  users?: number | null;
  risk?: 'Bajo' | 'Medio' | 'Alto' | null;
  details: Record<string, unknown>;
  status?: 'nuevo' | 'registrado' | 'desaparecido';
  agent?: string;
  days: number;
};

const BASIC = ['email', 'offline_access', 'openid', 'profile', 'User.Read'];

const MS: Item[] = [
  { source: 'entra', id: 'demo-app-chatgpt', kind: 'app', name: 'ChatGPT', vendor: 'OpenAI', platform: 'openai', users: 23, risk: 'Bajo', details: { category: 'Asistente general', scopes: BASIC, orgWide: false }, days: 41 },
  { source: 'entra', id: 'demo-app-otter', kind: 'app', name: 'Otter.ai', vendor: 'Otter.ai', platform: 'saas_ia', users: 6, risk: 'Medio', details: { category: 'Notas de reuniones', scopes: [...BASIC, 'Calendars.Read', 'OnlineMeetings.Read'], orgWide: false }, days: 19 },
  { source: 'entra', id: 'demo-app-fireflies', kind: 'app', name: 'Fireflies.ai Notetaker', vendor: 'Fireflies.ai', platform: 'saas_ia', users: 4, risk: 'Alto', details: { category: 'Notas de reuniones', scopes: [...BASIC, 'Calendars.ReadWrite', 'Mail.Send'], orgWide: false }, days: 9 },
  { source: 'entra', id: 'demo-app-grammarly', kind: 'app', name: 'Grammarly for Outlook', vendor: 'Grammarly', platform: 'saas_ia', users: null, risk: 'Alto', details: { category: 'Redacción', scopes: [...BASIC, 'Mail.ReadWrite'], orgWide: true }, days: 120 },
  { source: 'entra', id: 'demo-app-perplexity', kind: 'app', name: 'Perplexity', vendor: 'Perplexity', platform: 'saas_ia', users: 9, risk: 'Bajo', details: { category: 'Búsqueda con IA', scopes: BASIC, orgWide: false }, days: 27 },
  { source: 'entra', id: 'demo-app-deepseek', kind: 'app', name: 'DeepSeek', vendor: 'DeepSeek', platform: 'saas_ia', users: 2, risk: 'Bajo', details: { category: 'Asistente general', scopes: BASIC, orgWide: false }, days: 3 },
  { source: 'powerplatform', id: 'demo-cs-vacaciones', kind: 'agente', name: 'Vacaciones y permisos', vendor: 'Microsoft', platform: 'copilot_studio', owner: 'Laura Méndez', details: { environmentId: 'Default-altamar', location: 'unitedstates' }, days: 6 },
  { source: 'powerplatform', id: 'demo-cs-encuesta', kind: 'agente', name: 'Encuesta a huéspedes', vendor: 'Microsoft', platform: 'copilot_studio', owner: 'Gerencia Cancún', details: { environmentId: 'Default-altamar', location: 'unitedstates' }, days: 14 },
  { source: 'powerplatform', id: 'demo-cs-mesa-ti', kind: 'agente', name: 'Mesa de ayuda TI', vendor: 'Microsoft', platform: 'copilot_studio', owner: 'Carlos Méndez', details: { environmentId: 'TI-produccion', location: 'unitedstates' }, status: 'registrado', agent: 'Mesa de ayuda TI', days: 200 },
  { source: 'powerplatform', id: 'demo-cs-politicas', kind: 'agente', name: 'Políticas internas', vendor: 'Microsoft', platform: 'copilot_studio', owner: 'Jorge Pérez', details: { environmentId: 'Default-altamar', location: 'unitedstates' }, status: 'registrado', agent: 'Políticas internas', days: 160 },
  { source: 'powerplatform', id: 'demo-cs-compras', kind: 'agente', name: 'Agente de compras', vendor: 'Microsoft', platform: 'copilot_studio', owner: 'Compras', details: { environmentId: 'Default-altamar', location: 'unitedstates' }, status: 'registrado', agent: 'Agente de compras', days: 75 },
  { source: 'powerplatform', id: 'demo-cs-cotizaciones', kind: 'agente', name: 'Bot de cotizaciones', vendor: 'Microsoft', platform: 'copilot_studio', owner: 'Diego Ramos', details: { environmentId: 'Ventas', location: 'unitedstates' }, status: 'desaparecido', days: 300 },
];

const AWS: Item[] = [
  { source: 'bedrock', id: '111122223333:us-east-1:CONCIL01', kind: 'agente', name: 'Conciliación de facturas', vendor: 'AWS', platform: 'bedrock', details: { region: 'us-east-1', status: 'PREPARED' }, status: 'registrado', agent: 'Conciliación de facturas', days: 90 },
  { source: 'agentcore', id: '111122223333:us-east-1:extractor-v2', kind: 'agente', name: 'extractor-facturas-v2', vendor: 'AWS', platform: 'bedrock', details: { region: 'us-east-1', status: 'READY', description: 'Prueba de un equipo de Finanzas' }, days: 5 },
];

export async function ensureDemoDiscovery(tx: GovernTx, orgId: string) {
  const existing = await tx.select({ id: schema.connectors.id }).from(schema.connectors).where(eq(schema.connectors.organizationId, orgId)).limit(1);
  if (existing.length) return;
  const agents = await tx.select({ id: schema.aiAgents.id, name: schema.aiAgents.name }).from(schema.aiAgents).where(eq(schema.aiAgents.organizationId, orgId));
  const now = Date.now();

  const groups: [string, string, Item[]][] = [
    ['microsoft', 'altamar.onmicrosoft.com (ejemplo)', MS],
    ['aws', 'Cuenta 111122223333 (ejemplo)', AWS],
  ];
  for (const [provider, displayName, items] of groups) {
    const [c] = await tx
      .insert(schema.connectors)
      .values({
        organizationId: orgId,
        provider,
        status: 'demo',
        displayName,
        config: {},
        lastSyncAt: new Date(now - 3 * 3_600_000),
        lastSyncSummary: { found: items.filter((i) => i.status !== 'desaparecido').length, added: 0, gone: 0 },
      })
      .returning();
    for (const it of items) {
      const agentId = it.agent ? agents.find((a) => a.name === it.agent)?.id ?? null : null;
      await tx.insert(schema.discoveredItems).values({
        organizationId: orgId,
        connectorId: c!.id,
        provider,
        source: it.source,
        externalId: it.id,
        kind: it.kind,
        name: it.name,
        vendor: it.vendor,
        platform: it.platform,
        ownerName: it.owner ?? null,
        usersCount: it.users ?? null,
        suggestedRisk: it.risk ?? null,
        details: it.details,
        status: it.status === 'registrado' && !agentId ? 'nuevo' : it.status ?? 'nuevo',
        agentId,
        firstSeenAt: new Date(now - it.days * 86_400_000),
        lastSeenAt: new Date(now - (it.status === 'desaparecido' ? 12 : 0) * 86_400_000 - 3 * 3_600_000),
      });
    }
  }
}

