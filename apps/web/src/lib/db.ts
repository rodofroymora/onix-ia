import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  createDb,
  createPostgresDb,
  withOrg,
  type GovernDb,
} from '@onix/db';

const globalForDb = globalThis as unknown as {
  __onixGovern?: GovernDb;
};

function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
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
    return path.resolve(process.env.DATABASE_URL.slice('file:'.length));
  }
  return path.join(findRepoRoot(), '.data', 'govern.pg');
}

function isPostgresUrl(url: string | undefined): url is string {
  return !!url && /^postgres(ql)?:\/\//i.test(url);
}

export function getDb(): GovernDb {
  if (!globalForDb.__onixGovern) {
    const url = process.env.DATABASE_URL;
    if (isPostgresUrl(url)) {
      globalForDb.__onixGovern = createPostgresDb(url);
    } else {
      globalForDb.__onixGovern = createDb(resolveDataDir());
    }
  }
  return globalForDb.__onixGovern;
}

export function isUsingPostgres(): boolean {
  return isPostgresUrl(process.env.DATABASE_URL);
}

export { withOrg, resolveDataDir };
