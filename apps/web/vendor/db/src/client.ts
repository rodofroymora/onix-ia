import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index.js';

export type GovernDb = ReturnType<typeof createDb>;
export type GovernTx = Parameters<Parameters<GovernDb['db']['transaction']>[0]>[0];

/**
 * Cliente local con PGlite (archivo `.data/govern.pg` por defecto).
 * En producción se usará Postgres vía `DATABASE_URL`.
 */
export function createDb(dataDir = '.data/govern.pg') {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  return { client, db, schema };
}

export async function createMemoryDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  return { client, db, schema };
}

/** Fija el tenant actual (RLS) dentro de una transacción. */
export async function withOrg<T>(
  db: GovernDb['db'],
  organizationId: string,
  fn: (tx: GovernTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT govern_set_org(${organizationId}::uuid)`);
    return fn(tx);
  });
}
