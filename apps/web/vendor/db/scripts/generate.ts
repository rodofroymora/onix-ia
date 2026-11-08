/**
 * Genera artefactos de esquema.
 * Con Drizzle Kit cuando haya Postgres; aquí también asegura SQL bootstrap presente.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sqlDir } from './paths.js';

const init = path.join(sqlDir, '0001_init.sql');
const rls = path.join(sqlDir, 'rls.sql');

if (!existsSync(init) || !existsSync(rls)) {
  console.error('Faltan SQL de bootstrap en packages/db/sql');
  process.exit(1);
}

console.log('db:generate — esquema Drizzle en src/schema + SQL bootstrap listos:');
console.log(`  - ${init}`);
console.log(`  - ${rls}`);
console.log('  Tip: usa `drizzle-kit generate` cuando DATABASE_URL apunte a Postgres.');
