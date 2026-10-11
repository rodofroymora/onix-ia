#!/usr/bin/env node
'use strict';
/**
 * Pruebas de la regla robots/noindex del check 04 y de robots.rutasNoindex (solo /salud).
 * Uso: node scripts/tests/robots.test.js   (Node 20, sin dependencias)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('../checks/lib');

const raiz = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};

// ── Unidad
prueba('config real: rutasNoindex = ["/salud"]', base.robots.rutasNoindex, ['/salud']);
prueba('config real válida', L.validarRutasNoindex(base), []);
prueba('guarda: otra ruta es error de configuración', L.validarRutasNoindex({ robots: { rutasNoindex: ['/salud', '/servicios'] } }).length, 1);
prueba('guarda: comodín es error', L.validarRutasNoindex({ robots: { rutasNoindex: ['/*'] } }).length, 1);
prueba('guarda: «/» es error', L.validarRutasNoindex({ robots: { rutasNoindex: ['/'] } }).length, 1);
prueba('guarda: no-lista es error', L.validarRutasNoindex({ robots: { rutasNoindex: '/salud' } }).length, 1);
prueba('sin rutasNoindex es válido', L.validarRutasNoindex({ robots: {} }), []);
const urls = ['/salud', '/salud/', '/salud/preguntas', '/saludable', '/', '/servicios', '/servicios/salud', '/aviso-de-privacidad'];
prueba('rutaNoindexPermitida', urls.map((u) => L.rutaNoindexPermitida(base, u)), [true, true, true, false, false, false, false, false]);
prueba('rutaNoindexPermitida con config inválida → nada', urls.map((u) => L.rutaNoindexPermitida({ robots: { rutasNoindex: ['/salud', '/x'] } }, u)).some(Boolean), false);
const srcs = ['/salud', '/salud/(.*)', '/salud/:path*', '/(.*)', '/(.*)salud', '/servicios', '/salud-x', '/salud/(.*)/otra', '', undefined];
prueba('sourceNoindexPermitido', srcs.map((x) => L.sourceNoindexPermitido(base, x)), [true, true, true, false, false, false, false, false, false, false]);

// ── Integración (check 04 en un sitio temporal)
const META_NOINDEX = '<meta name="robots" content="noindex, nofollow">';
const pag = (titulo, meta) => `<!doctype html><html lang="es"><head><title>${titulo} ÓNIX sitio de prueba</title><meta name="description" content="Descripción de prueba suficientemente larga para pasar el check de QA del sitio."> ${meta || ''}</head><body><main><h1>${titulo}</h1><p>Texto.</p></main></body></html>`;
function sitio(archivos, ajustes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'robots-test-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const r = JSON.parse(JSON.stringify(base));
  if (ajustes) ajustes(r);
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(r));
  for (const [n, c] of Object.entries(archivos)) { fs.mkdirSync(path.dirname(path.join(tmp, n)), { recursive: true }); fs.writeFileSync(path.join(tmp, n), c); }
  return tmp;
}
function correr(rama, archivos, ajustes) {
  const tmp = sitio(archivos, ajustes);
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', '04-qa-smoke.js')], { cwd: tmp, encoding: 'utf8', env: Object.assign({}, process.env, { CHECK_BRANCH: rama, GITHUB_ACTIONS: '' }) });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { status: p.status, out: p.stdout };
}
const HDR = (source) => JSON.stringify({ headers: [{ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] });
const ROBOTS_OK = 'User-agent: *\nAllow: /\n';
const base_main = { 'index.html': pag('Inicio'), 'servicios.html': pag('Servicios'), 'vercel.json': '{}', 'robots.txt': ROBOTS_OK };

prueba('main: sitio indexable sin noindex → pasa', correr('main', base_main).status, 0);
prueba('main: /salud (salud.html) con meta noindex → pasa la regla robots', correr('main', Object.assign({}, base_main, { 'salud.html': pag('Salud', META_NOINDEX) })).status, 0);
prueba('main: /salud/index.html con meta noindex → pasa', correr('main', Object.assign({}, base_main, { 'salud/index.html': pag('Salud', META_NOINDEX) })).status, 0);
prueba('main: /salud/preguntas con meta noindex → pasa', correr('main', Object.assign({}, base_main, { 'salud/preguntas.html': pag('Preguntas', META_NOINDEX) })).status, 0);
prueba('main: /salud con header noindex acotado (source /salud) → pasa', correr('main', Object.assign({}, base_main, { 'salud.html': pag('Salud', META_NOINDEX), 'vercel.json': HDR('/salud') })).status, 0);
prueba('main: header noindex source /salud/(.*) → pasa', correr('main', Object.assign({}, base_main, { 'vercel.json': HDR('/salud/(.*)') })).status, 0);
const o1 = correr('main', Object.assign({}, base_main, { 'servicios.html': pag('Servicios', META_NOINDEX) }));
prueba('main: OTRA página con noindex → FALLA', [o1.status, /servicios\.html/.test(o1.out)], [1, true]);
const o2 = correr('main', Object.assign({}, base_main, { 'index.html': pag('Inicio', META_NOINDEX), 'salud.html': pag('Salud', META_NOINDEX) }));
prueba('main: /salud noindex + index.html noindex → FALLA solo por index.html', [o2.status, /index\.html/.test(o2.out), /salud\.html/.test(o2.out.split('✖ ERROR')[1] || '')], [1, true, false]);
prueba('main: página parecida (saludable.html) con noindex → FALLA', correr('main', Object.assign({}, base_main, { 'saludable.html': pag('Saludable', META_NOINDEX) })).status, 1);
prueba('main: servicios/salud.html con noindex → FALLA', correr('main', Object.assign({}, base_main, { 'servicios/salud.html': pag('S', META_NOINDEX) })).status, 1);
prueba('main: header noindex GLOBAL «/(.*)» → FALLA', correr('main', Object.assign({}, base_main, { 'vercel.json': HDR('/(.*)') })).status, 1);
prueba('main: header noindex «/servicios» → FALLA', correr('main', Object.assign({}, base_main, { 'vercel.json': HDR('/servicios') })).status, 1);
prueba('main: header noindex «/salud-x» → FALLA', correr('main', Object.assign({}, base_main, { 'vercel.json': HDR('/salud-x') })).status, 1);
prueba('main: robots.txt «Disallow: /» → FALLA', correr('main', Object.assign({}, base_main, { 'robots.txt': 'User-agent: *\nDisallow: /\n' })).status, 1);
prueba('main: rutasNoindex con otra ruta → FALLA (error de configuración)', correr('main', base_main, (r) => { r.robots.rutasNoindex = ['/salud', '/servicios']; }).status, 1);
prueba('main: con rutasNoindex inválida, ni /salud pasa', correr('main', Object.assign({}, base_main, { 'salud.html': pag('Salud', META_NOINDEX) }), (r) => { r.robots.rutasNoindex = ['/salud', '/otra']; }).status, 1);
prueba('main: sin rutasNoindex, /salud noindex → FALLA', correr('main', Object.assign({}, base_main, { 'salud.html': pag('Salud', META_NOINDEX) }), (r) => { delete r.robots.rutasNoindex; }).status, 1);

// dev: comportamiento sin cambios (todo noindex)
const dev_ok = { 'index.html': pag('Inicio', META_NOINDEX), 'salud.html': pag('Salud', META_NOINDEX), 'vercel.json': HDR('/(.*)'), 'robots.txt': 'User-agent: *\nDisallow: /\n' };
prueba('dev: todo noindex (incl. /salud) → pasa', correr('dev', dev_ok).status, 0);
prueba('dev: una página sin noindex → FALLA', correr('dev', Object.assign({}, dev_ok, { 'servicios.html': pag('Servicios') })).status, 1);
prueba('dev: /salud sin noindex → FALLA (rutasNoindex no relaja dev)', correr('dev', Object.assign({}, dev_ok, { 'salud.html': pag('Salud') })).status, 1);
prueba('dev: header global ausente → FALLA', correr('dev', Object.assign({}, dev_ok, { 'vercel.json': '{}' })).status, 1);
prueba('dev: la comprobación del header no cambia (cualquier source noindex cuenta) → pasa', correr('dev', Object.assign({}, dev_ok, { 'vercel.json': HDR('/salud') })).status, 0);

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron.` : '\n✔ Todas las pruebas de robots pasaron.');
process.exit(fallos ? 1 : 0);
