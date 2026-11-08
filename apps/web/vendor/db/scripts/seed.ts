import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createDb, ensureDemoSeed } from '../src/index.js';
import { dataDir, repoRoot } from './paths.js';

async function main() {
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const govern = createDb(dataDir);
  await ensureDemoSeed(govern, {
    snapshotPath: path.resolve(repoRoot, '.data/demo-auth.json'),
  });
  await govern.client.close();
  console.log(`Seed OK → ${path.relative(repoRoot, dataDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
