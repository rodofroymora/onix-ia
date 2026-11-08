import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ensureDemoSeed } from '@onix/db';
import { getDb, resolveDataDir } from '@/lib/db';

let ready: Promise<void> | null = null;

/** Migra/siembra demo la primera vez (sin shippear .data binario). */
export function ensureDemoReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const dataDir = resolveDataDir();
      mkdirSync(path.dirname(dataDir), { recursive: true });
      const govern = getDb();
      const snapshotPath = path.join(path.dirname(dataDir), 'demo-auth.json');
      const sqlDirectory = path.join(process.cwd(), 'vendor/db/sql');
      await ensureDemoSeed(govern, { snapshotPath, sqlDirectory });
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
