import { existsSync } from 'node:fs';
import path from 'node:path';
import { createDb, withOrg, type GovernDb } from '@onix/db';

const globalForDb = globalThis as unknown as {
  __onixGovern?: GovernDb;
};

function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    // Preferir carpeta con snapshot demo (apps/web en publish) o monorepo.
    if (existsSync(path.join(dir, '.data', 'demo-auth.json'))) return dir;
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function resolveDataDir(): string {
  if (process.env.PGLITE_DATA_DIR) {
    return path.resolve(process.env.PGLITE_DATA_DIR);
  }
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    // file:/abs/path → /abs/path (evitar pasar URL a fs)
    return path.resolve(process.env.DATABASE_URL.slice('file:'.length));
  }
  return path.join(findRepoRoot(), '.data', 'govern.pg');
}

export function getDb(): GovernDb {
  if (!globalForDb.__onixGovern) {
    const dataDir = resolveDataDir();
    globalForDb.__onixGovern = createDb(dataDir);
  }
  return globalForDb.__onixGovern;
}

export { withOrg, resolveDataDir };
