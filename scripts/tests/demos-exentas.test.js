#!/usr/bin/env node
'use strict';
/**
 * Pruebas de robots.rutasExentasDemos (check 04): las páginas bajo «demos/» (prefijo exacto) no entran en la regla de indexación
 * del fuente porque nunca se publican; cualquier otra página (incl. «demos-ia/») sigue fallando. H-39 no cambia de alcance.
 * Uso: node scripts/tests/demos-exentas.test.js   (Node 20, sin dependencias)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const raiz = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};
const NI = '<meta name="robots" content="noindex, nofollow">';
const pag = (titulo, cabeza = '', cuerpo = '<p>Texto.</p>') => `<!doctype html>
<html lang="es"><head><title>${titulo} ÓNIX sitio de prueba</title>
<meta name="description" content="Descripción de prueba suficientemente larga para pasar el check de QA del sitio.">
${cabeza}</head>
<body><main><h1>${titulo}</h1>
${cuerpo}</main></body></html>
`;
const SM = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.onix-ia.com/</loc></url></urlset>';
const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${base.robots.sitemapUrl}\n`;
const limpio = { 'index.html': pag('Inicio'), 'vercel.json': '{}', 'robots.txt': ROBOTS, 'sitemap.xml': SM };
const con = (x) => Object.assign({}, limpio, x);

function correr(rama, archivos, ajustes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-test-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const r = JSON.parse(JSON.stringify(base)); if (ajustes) ajustes(r);
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(r));
  for (const [n, c] of Object.entries(archivos)) { fs.mkdirSync(path.dirname(path.join(tmp, n)), { recursive: true }); fs.writeFileSync(path.join(tmp, n), c); }
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', '04-qa-smoke.js')], { cwd: tmp, encoding: 'utf8', env: Object.assign({}, process.env, { CHECK_BRANCH: rama, GITHUB_ACTIONS: '' }) });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { status: p.status, out: p.stdout };
}
prueba('config real: rutasExentasDemos = ["demos/"]', base.robots.rutasExentasDemos, ['demos/']);

for (const rama of ['dev', 'main']) {
  prueba(`${rama}: sitio limpio → pasa`, correr(rama, limpio).status, 0);
  prueba(`${rama}: demos/x.html con noindex → PASA`, correr(rama, con({ 'demos/x.html': pag('Demo', NI) })).status, 0);
  prueba(`${rama}: demos/sub/y.html con noindex → PASA`, correr(rama, con({ 'demos/sub/y.html': pag('Demo', NI) })).status, 0);
  const o = correr(rama, con({ 'demos/x.html': pag('Demo', NI) }));
  prueba(`${rama}: la salida informa de las páginas de demos/ exentas`, /rutasExentasDemos: 1 página/.test(o.out), true);
  const b = correr(rama, con({ 'servicios.html': pag('Servicios', NI) }));
  prueba(`${rama}: noindex en una página NO demo → FALLA`, [b.status, /servicios\.html/.test(b.out)], [1, true]);
  const c = correr(rama, con({ 'demos-ia/x.html': pag('Demo', NI) }));
  prueba(`${rama}: demos-ia/x.html con noindex → FALLA (no es demos/)`, [c.status, /demos-ia\/x\.html/.test(c.out)], [1, true]);
  prueba(`${rama}: demos.html (raíz) con noindex → FALLA`, correr(rama, con({ 'demos.html': pag('Demos', NI) })).status, 1);
  prueba(`${rama}: servicios/demos/x.html con noindex → FALLA (solo el prefijo en la raíz)`, correr(rama, con({ 'servicios/demos/x.html': pag('Demo', NI) })).status, 1);
  prueba(`${rama}: demos/ exento pero una página real con noindex junto a ella → FALLA`, correr(rama, con({ 'demos/x.html': pag('Demo', NI), 'servicios.html': pag('Servicios', NI) })).status, 1);
  prueba(`${rama}: robots.txt con «Disallow: /» sigue fallando aunque haya demos/`, correr(rama, con({ 'demos/x.html': pag('Demo', NI), 'robots.txt': ROBOTS + 'User-agent: *\nDisallow: /\n' })).status, 1);
  prueba(`${rama}: vercel.json con X-Robots-Tag noindex global sigue fallando aunque haya demos/`, correr(rama, con({ 'demos/x.html': pag('Demo', NI), 'vercel.json': JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }] }) })).status, 1);
  prueba(`${rama}: sin la config rutasExentasDemos, demos/ con noindex FALLA (exención explícita)`, correr(rama, con({ 'demos/x.html': pag('Demo', NI) }), (r) => { delete r.robots.rutasExentasDemos; }).status, 1);
}
// ── guarda de configuración
for (const [n, v] of [['demos-ia/', ['demos-ia/']], ['demos (sin barra)', ['demos']], ['/demos/', ['/demos/']], ['demos/ + servicios/', ['demos/', 'servicios/']], ['cadena en vez de lista', 'demos/'], ['raíz /', ['/']], ['vacío ""', ['']]]) {
  const r = correr('main', con({ 'demos/x.html': pag('Demo', NI) }), (j) => { j.robots.rutasExentasDemos = v; });
  prueba(`guarda: rutasExentasDemos = ${n} → error de configuración y no exime nada`, [r.status, /rutasExentasDemos/.test(r.out)], [1, true]);
}
prueba('guarda: lista vacía → válida, no exime (demos/ con noindex falla)', correr('main', con({ 'demos/x.html': pag('Demo', NI) }), (j) => { j.robots.rutasExentasDemos = []; }).status, 1);
// ── H-39 conserva su alcance (paquete público, fuera de demos/)
prueba('H-39 main: «Aprobar borrador» en demos/ → pasa (fuera de alcance)', correr('main', con({ 'demos/x.html': pag('Demo', NI, '<button>Aprobar borrador</button>') })).status, 0);
prueba('H-39 main: «borrador» en demos-ia/ → FALLA (sí es paquete público)', correr('main', con({ 'demos-ia/x.html': pag('Demo', '', '<p>borrador</p>') })).status, 1);
prueba('H-39 main: «borrador» en página normal → FALLA', correr('main', con({ 'servicios.html': pag('Servicios', '', '<p>borrador</p>') })).status, 1);
prueba('H-39 dev: «borrador» en página normal → no bloquea', correr('dev', con({ 'servicios.html': pag('Servicios', '', '<p>borrador</p>') })).status, 0);

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron.` : '\n✔ Todas las pruebas de la exención de demos/ pasaron.');
process.exit(fallos ? 1 : 0);
