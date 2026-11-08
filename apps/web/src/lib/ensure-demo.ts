import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ensureDemoSeed } from '@onix/db';
import { getDb, isUsingPostgres, resolveDataDir } from '@/lib/db';

let ready: Promise<void> | null = null;

/** Migra/siembra demo la primera vez (PGlite local o Postgres en publish). */
export function ensureDemoReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!isUsingPostgres()) {
        const dataDir = resolveDataDir();
        mkdirSync(path.dirname(dataDir), { recursive: true });
      }
      const govern = getDb();
      const snapshotPath = path.join(process.cwd(), '.data', 'demo-auth.json');
      mkdirSync(path.dirname(snapshotPath), { recursive: true });
      const sqlDirectory = path.join(process.cwd(), 'vendor/db/sql');
      await ensureDemoSeed(govern, { snapshotPath, sqlDirectory });
    })().catch((err) => {
      ready = null;
      console.error('[ensure-demo] falló el bootstrap', err);
      throw err;
    });
  }
  return ready;
}
