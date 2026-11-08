import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { dataDir, repoRoot, sqlDir } from './paths.js';

async function main() {
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);

  const files = ['0001_init.sql', 'rls.sql'];
  for (const f of files) {
    const full = path.join(sqlDir, f);
    if (!existsSync(full)) throw new Error(`No existe ${full}`);
    const sql = readFileSync(full, 'utf8');
    console.log(`Aplicando ${f}…`);
    await client.exec(sql);
  }

  await client.close();
  console.log(`Migración OK → ${path.relative(repoRoot, dataDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
