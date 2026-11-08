#!/usr/bin/env node
// Compila los paquetes vendorizados (apps/web/vendor/*) antes de `next build`.
// `dist/` está en .gitignore, así que en publish (checkout aislado de apps/web)
// hay que generarlo aquí. Orden: primero los que no dependen de otros @onix/*.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(webDir, 'package.json'));
const tsc = require.resolve('typescript/bin/tsc');

const order = ['engine', 'templates', 'ui', 'agent', 'db'];

for (const pkg of order) {
  const tsconfig = path.join(webDir, 'vendor', pkg, 'tsconfig.json');
  if (!existsSync(tsconfig)) {
    console.error(`[build-vendor] Falta ${tsconfig}`);
    process.exit(1);
  }
  console.log(`[build-vendor] @onix/${pkg}`);
  execFileSync(process.execPath, [tsc, '-p', tsconfig], { stdio: 'inherit', cwd: webDir });
}

console.log('[build-vendor] OK');
