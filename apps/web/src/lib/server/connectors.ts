import { desc, eq } from 'drizzle-orm';
import { connectors, discoveredItems } from '@onix/db';
import { awsConfigured, onixAwsAccountId } from '@/lib/connectors/aws';
import { encryptionReady } from '@/lib/connectors/crypto';
import { microsoftConfigured } from '@/lib/connectors/microsoft';
import { getDb, withOrg } from '@/lib/db';

export interface ConnectorView {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  summary: { found?: number; added?: number; gone?: number };
  /** Solo datos no sensibles: nunca el token. */
  config: { externalId?: string; roleArn?: string; regions?: string[]; tenantId?: string; account?: string; sources?: string[] };
}

export async function loadConnectors(orgId: string) {
  const { db } = getDb();
  const rows = await withOrg(db, orgId, (tx) => tx.select().from(connectors).where(eq(connectors.organizationId, orgId)));
  const list: ConnectorView[] = rows.map((r) => {
    const c = r.config as ConnectorView['config'];
    return {
      id: r.id,
      provider: r.provider,
      status: r.status,
      displayName: r.displayName,
      lastSyncAt: r.lastSyncAt,
      lastError: r.lastError,
      summary: r.lastSyncSummary as ConnectorView['summary'],
      config: { externalId: c.externalId, roleArn: c.roleArn, regions: c.regions, tenantId: c.tenantId, account: c.account, sources: c.sources },
    };
  });
  return {
    list,
    ready: {
      microsoft: microsoftConfigured() && encryptionReady(),
      aws: awsConfigured(),
      google: false,
    },
    onixAwsAccount: onixAwsAccountId(),
  };
}

export type DiscoveredRow = typeof discoveredItems.$inferSelect;

export async function loadDiscovered(orgId: string): Promise<DiscoveredRow[]> {
  const { db } = getDb();
  return withOrg(db, orgId, (tx) => tx.select().from(discoveredItems).where(eq(discoveredItems.organizationId, orgId)).orderBy(desc(discoveredItems.firstSeenAt)));
}
