import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const pkgRoot = path.resolve(here, '..');
export const repoRoot = path.resolve(pkgRoot, '../..');
export const dataDir = path.resolve(repoRoot, '.data/govern.pg');
export const sqlDir = path.resolve(pkgRoot, 'sql');
