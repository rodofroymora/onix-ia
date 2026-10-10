#!/usr/bin/env node
'use strict';
/**
 * Ejecuta todos los checks de release (Node 20, sin dependencias).
 * Uso:  node scripts/checks/run-all.js            (rama detectada automáticamente)
 *       CHECK_BRANCH=main node scripts/checks/run-all.js
 * Sale con código 1 si falla cualquier check (así CI bloquea el merge).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const checks = [
  ['01-cifras-consistencia.js', 'Cifras, plazos, precios, sectores y WhatsApp'],
  ['02-cta-unico.js', 'Un solo CTA primario por página'],
  ['03-enlaces-y-assets.js', 'Enlaces internos, anclas y assets'],
  ['04-qa-smoke.js', 'QA smoke (title, description, lang, h1, alt, residuos, robots)'],
  ['05-frases-prohibidas.js', 'Frases prohibidas (bloqueantes y advertencias)'],
];
const fallos = [];
for (const [archivo, titulo] of checks) {
  const r = spawnSync(process.execPath, [path.join(__dirname, archivo)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) fallos.push(titulo);
}
console.log('\n══════════ RESUMEN ══════════');
for (const [, titulo] of checks) console.log((fallos.includes(titulo) ? '✖ FALLÓ  ' : '✔ OK     ') + titulo);
if (fallos.length) {
  console.log(`\n✖ ${fallos.length} de ${checks.length} checks fallaron. El PR NO se puede fusionar hasta corregirlos (o, si la regla es incorrecta, actualizar release-rules.json con aprobación del dueño del sitio).`);
  process.exit(1);
}
console.log('\n✔ Todos los checks pasaron.');
