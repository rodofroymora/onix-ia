import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema/index.js';

export type GovernDatabase =
  | PgliteDatabase<typeof schema>
  | NodePgDatabase<typeof schema>;

export type GovernDb = {
  kind: 'pglite' | 'postgres';
  client: PGlite | Pool;
  db: GovernDatabase;
  schema: typeof schema;
};

export type GovernTx = Parameters<Parameters<GovernDatabase['transaction']>[0]>[0];

/**
 * Cliente local con PGlite (archivo `.data/govern.pg` por defecto).
 */
export function createDb(dataDir = '.data/govern.pg'): GovernDb {
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  return { kind: 'pglite', client, db, schema };
}

/** Postgres (Cursor publish / DATABASE_URL). */
export function createPostgresDb(connectionString: string): GovernDb {
  const client = new Pool({ connectionString });
  const db = drizzlePg(client, { schema });
  return { kind: 'postgres', client, db, schema };
}

export async function createMemoryDb(): Promise<GovernDb> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  return { kind: 'pglite', client, db, schema };
}

/** Fija el tenant actual (RLS) dentro de una transacción. */
export async function withOrg<T>(
  db: GovernDatabase,
  organizationId: string,
  fn: (tx: GovernTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT govern_set_org(${organizationId}::uuid)`);
    return fn(tx as GovernTx);
  });
}
