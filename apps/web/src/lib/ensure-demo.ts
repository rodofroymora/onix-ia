import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ensureDemoSeed } from '@onix/db';
import { getDb, isUsingPostgres, resolveDataDir } from '@/lib/db';

let ready: Promise<void> | null = null;
let lastError: string | null = null;

/**
 * Migra y siembra la demo la primera vez (PGlite local o Postgres en publish).
 * Si falla, se puede reintentar en la siguiente petición; nunca tumba el servidor.
 */
export function ensureDemoReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!isUsingPostgres()) {
        const dataDir = resolveDataDir();
        mkdirSync(path.dirname(dataDir), { recursive: true });
      }
      const govern = getDb();
      const sqlDirectory = path.join(process.cwd(), 'vendor/db/sql');
      await ensureDemoSeed(govern, { sqlDirectory });
      lastError = null;
    })().catch((err: unknown) => {
      ready = null;
      lastError = err instanceof Error ? err.message : String(err);
      console.error('[ensure-demo] falló el bootstrap', err);
      throw err;
    });
  }
  return ready;
}

/** Igual que ensureDemoReady, pero sin lanzar: para rutas que deben responder siempre. */
export async function tryEnsureDemoReady(): Promise<boolean> {
  try {
    await ensureDemoReady();
    return true;
  } catch {
    return false;
  }
}

export function getBootstrapError(): string | null {
  return lastError;
}
