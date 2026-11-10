import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { connectors, discoveredItems } from '@onix/db';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { syncAws } from './aws';
import { decryptSecret, encryptSecret } from './crypto';
import { syncMicrosoft } from './microsoft';
import { ConnectorError, type DiscoveredInput, type SyncResult } from './types';

type ConnectorRow = typeof connectors.$inferSelect;

export interface SyncOutcome {
  ok: boolean;
  found: number;
  added: number;
  gone: number;
  message: string;
}

/** Guarda lo encontrado: agrega nuevos, actualiza los vistos y marca los que ya no aparecen. */
export async function persistDiscovery(orgId: string, connector: ConnectorRow, result: SyncResult, actorUserId: string | null): Promise<SyncOutcome> {
  const { db } = getDb();
  return withOrg(db, orgId, async (tx) => {
    const now = new Date();
    const existing = await tx
      .select()
      .from(discoveredItems)
      .where(and(eq(discoveredItems.organizationId, orgId), eq(discoveredItems.connectorId, connector.id)));
    const byKey = new Map(existing.map((e) => [`${e.source}|${e.externalId}`, e]));
    let added = 0;
    const seen = new Set<string>();

    for (const it of dedupe(result.items)) {
      const key = `${it.source}|${it.externalId}`;
      seen.add(key);
      const prev = byKey.get(key);
      const values = {
        kind: it.kind,
        name: it.name.slice(0, 200),
        vendor: it.vendor,
        platform: it.platform,
        ownerName: it.ownerName?.slice(0, 160) ?? null,
        usersCount: it.usersCount,
        suggestedRisk: it.suggestedRisk,
        details: it.details,
        lastSeenAt: now,
        updatedAt: now,
      };
      if (prev) {
        await tx
          .update(discoveredItems)
          .set({ ...values, status: prev.status === 'desaparecido' ? (prev.agentId ? 'registrado' : 'nuevo') : prev.status })
          .where(eq(discoveredItems.id, prev.id));
      } else {
        added++;
        await tx.insert(discoveredItems).values({
          ...values,
          organizationId: orgId,
          connectorId: connector.id,
          provider: connector.provider,
          source: it.source,
          externalId: it.externalId.slice(0, 400),
          status: 'nuevo',
          firstSeenAt: now,
        });
      }
    }

    // Solo se marcan como desaparecidos los de fuentes que respondieron bien.
    const goneIds = existing
      .filter((e) => result.okSources.includes(e.source as DiscoveredInput['source']) && !seen.has(`${e.source}|${e.externalId}`) && e.status !== 'desaparecido' && e.status !== 'ignorado')
      .map((e) => e.id);
    if (goneIds.length) await tx.update(discoveredItems).set({ status: 'desaparecido', updatedAt: now }).where(inArray(discoveredItems.id, goneIds));

    const message = result.warnings.length ? result.warnings.join(' ') : 'Sincronización completa.';
    await tx
      .update(connectors)
      .set({
        status: result.okSources.length ? 'conectado' : 'error',
        lastSyncAt: now,
        lastError: result.warnings.length ? message.slice(0, 600) : null,
        lastSyncSummary: { found: seen.size, added, gone: goneIds.length, sources: result.okSources },
        updatedAt: now,
      })
      .where(eq(connectors.id, connector.id));
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId,
      action: 'connector.sync',
      entityType: 'connector',
      entityId: connector.id,
      meta: { provider: connector.provider, found: seen.size, added, gone: goneIds.length },
    });
    return { ok: result.okSources.length > 0, found: seen.size, added, gone: goneIds.length, message };
  });
}

function dedupe(items: DiscoveredInput[]): DiscoveredInput[] {
  const m = new Map<string, DiscoveredInput>();
  for (const it of items) m.set(`${it.source}|${it.externalId}`, it);
  return [...m.values()];
}

async function markError(orgId: string, connectorId: string, message: string) {
  const { db } = getDb();
  await withOrg(db, orgId, (tx) =>
    tx.update(connectors).set({ status: 'error', lastError: message.slice(0, 600), lastSyncAt: new Date(), updatedAt: new Date() }).where(eq(connectors.id, connectorId)),
  );
}

/** Corre un conector de punta a punta. Nunca lanza: deja el error guardado en el conector. */
export async function runConnector(orgId: string, connector: ConnectorRow, actorUserId: string | null): Promise<SyncOutcome> {
  try {
    if (connector.status === 'demo') return { ok: true, found: 0, added: 0, gone: 0, message: 'Conector de demostración: los datos son de ejemplo.' };
    if (connector.provider === 'microsoft') {
      const cfg = connector.config as { tenantId?: string };
      if (!connector.secretEnc || !cfg.tenantId) throw new ConnectorError('Falta volver a conectar Microsoft 365.');
      const r = await syncMicrosoft(fetch, { tenantId: cfg.tenantId, refreshToken: decryptSecret(connector.secretEnc) });
      const { db } = getDb();
      await withOrg(db, orgId, (tx) => tx.update(connectors).set({ secretEnc: encryptSecret(r.refreshToken) }).where(eq(connectors.id, connector.id)));
      return await persistDiscovery(orgId, connector, r, actorUserId);
    }
    if (connector.provider === 'aws') {
      const cfg = connector.config as { roleArn?: string; externalId?: string; regions?: string[] };
      if (!cfg.roleArn || !cfg.externalId) throw new ConnectorError('Falta el ARN del rol de AWS.');
      const r = await syncAws({ roleArn: cfg.roleArn, externalId: cfg.externalId, regions: cfg.regions?.length ? cfg.regions : ['us-east-1'] });
      return await persistDiscovery(orgId, connector, r, actorUserId);
    }
    throw new ConnectorError('Este conector todavía no está disponible.');
  } catch (e) {
    const msg = e instanceof ConnectorError ? `${e.message}${e.hint ? ` ${e.hint}` : ''}` : 'Error inesperado al sincronizar.';
    if (!(e instanceof ConnectorError)) console.error('[conectores] sync falló', e);
    await markError(orgId, connector.id, msg);
    return { ok: false, found: 0, added: 0, gone: 0, message: msg };
  }
}

/** Para la tarea diaria: todos los conectores activos de todas las organizaciones. */
export async function syncAllConnectors(orgIds: string[]): Promise<{ runs: number; errors: number }> {
  const { db } = getDb();
  let runs = 0;
  let errors = 0;
  for (const orgId of orgIds) {
    const list = await withOrg(db, orgId, (tx) =>
      tx
        .select()
        .from(connectors)
        .where(and(eq(connectors.organizationId, orgId), notInArray(connectors.status, ['demo', 'pendiente']))),
    );
    for (const c of list) {
      runs++;
      const r = await runConnector(orgId, c, null);
      if (!r.ok) errors++;
    }
  }
  return { runs, errors };
}
