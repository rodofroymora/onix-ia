import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema/index.js';

export type GovernDb = ReturnType<typeof createDb>;

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
