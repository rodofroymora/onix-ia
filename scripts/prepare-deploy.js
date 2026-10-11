#!/usr/bin/env node
'use strict';
/**
 * Deja en el directorio de trabajo SOLO los archivos públicos del sitio antes de `vercel build`.
 * Motivo: vercel.json usa outputDirectory "." → todo lo que esté en la raíz se publicaría
 * (scripts/, release-rules.json, workflows...). Este script es DESTRUCTIVO:
 * solo corre en GitHub Actions (o con --force sobre un clon desechable).
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
if (process.env.GITHUB_ACTIONS !== 'true' && !process.argv.includes('--force')) {
  console.error('✖ prepare-deploy.js borra archivos del directorio actual. Solo corre en GitHub Actions o con --force en un clon desechable.');
  process.exit(1);
}
// `demos` (demos en desarrollo) NO se publica ni en DEV ni en PROD hasta que la dirección decida publicarlas.
const NO_PUBLICOS = ['.github', 'scripts', 'demos', 'release-rules.json', 'README.md', 'CONTRIBUTING.md', '.gitignore'];
for (const n of NO_PUBLICOS) {
  const p = path.join(root, n);
  if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); console.log('− removido del paquete de deploy: ' + n); }
}
for (const n of fs.readdirSync(root)) {
  if (/^\.env/.test(n)) { fs.rmSync(path.join(root, n), { force: true }); console.log('− removido: ' + n); }
}
console.log('✔ Paquete de deploy listo (solo archivos públicos del sitio).');
