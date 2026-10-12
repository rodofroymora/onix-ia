#!/usr/bin/env node
'use strict';
/**
 * Pruebas del noindex «al desplegar»: scripts/prepare-deploy.js (DEPLOY_ENV=dev|prod) y scripts/verify-deploy.js.
 * Uso: node scripts/tests/deploy-noindex.test.js   (Node 20, sin dependencias, sin red externa: servidor HTTP local)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync, spawn } = require('child_process');

const raiz = path.resolve(__dirname, '..', '..');
const reglas = fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8');
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};

const pag = (t, meta = '') => `<!doctype html>\n<html lang="es">\n<head>\n  <meta charset="utf-8" />\n  <title>${t}</title>\n${meta}</head>\n<body><h1>${t}</h1></body>\n</html>\n`;
const ROBOTS_PROD = 'User-agent: *\nAllow: /\n\nSitemap: https://www.onix-ia.com/sitemap.xml\n';
const SITEMAP = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
const VJ = { cleanUrls: true, headers: [{ source: '/fonts/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }] };

function sitio(extra = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-test-'));
  fs.mkdirSync(path.join(tmp, 'scripts'));
  fs.copyFileSync(path.join(raiz, 'scripts', 'prepare-deploy.js'), path.join(tmp, 'scripts', 'prepare-deploy.js'));
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), reglas);
  fs.mkdirSync(path.join(tmp, 'demos')); fs.writeFileSync(path.join(tmp, 'demos', 'x.html'), pag('demo'));
  fs.mkdirSync(path.join(tmp, '.github')); fs.writeFileSync(path.join(tmp, 'README.md'), '# x');
  const archivos = Object.assign({ 'index.html': pag('Inicio'), 'servicios/radar.html': pag('Radar'), 'aviso-de-privacidad.html': pag('Aviso de privacidad'), 'robots.txt': ROBOTS_PROD, 'sitemap.xml': SITEMAP, 'vercel.json': JSON.stringify(VJ) }, extra);
  for (const [n, c] of Object.entries(archivos)) { fs.mkdirSync(path.dirname(path.join(tmp, n)), { recursive: true }); fs.writeFileSync(path.join(tmp, n), c); }
  return tmp;
}
const lee = (tmp, n) => fs.readFileSync(path.join(tmp, n), 'utf8');
function prepara(tmp, env) {
  const e = Object.assign({}, process.env, { GITHUB_ACTIONS: 'true' }); delete e.DEPLOY_ENV;
  if (env !== undefined) e.DEPLOY_ENV = env;
  return spawnSync(process.execPath, [path.join(tmp, 'scripts', 'prepare-deploy.js')], { cwd: tmp, encoding: 'utf8', env: e });
}
const META = /<meta name="robots" content="noindex, nofollow" \/>/g;

// ── prepare-deploy: DEV
{
  const tmp = sitio(); const p = prepara(tmp, 'dev');
  prueba('dev: sale con 0', p.status, 0);
  prueba('dev: robots.txt = «Disallow: /»', lee(tmp, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const v = JSON.parse(lee(tmp, 'vercel.json'));
  const xr = v.headers.filter((h) => h.headers.some((k) => k.key === 'X-Robots-Tag'));
  prueba('dev: vercel.json con UN header X-Robots-Tag noindex global', [xr.length, xr[0].source, xr[0].headers[0].value], [1, '/(.*)', 'noindex, nofollow']);
  prueba('dev: conserva los demás headers y claves de vercel.json', [v.cleanUrls, v.headers.some((h) => h.source === '/fonts/(.*)')], [true, true]);
  prueba('dev: meta noindex en cada página (home y subcarpeta), una vez', ['index.html', 'servicios/radar.html'].map((f) => (lee(tmp, f).match(META) || []).length), [1, 1]);
  prueba('dev: la meta queda dentro del <head>', /<head>\n  <meta name="robots"[^>]*>\n  <meta charset/.test(lee(tmp, 'index.html')), true);
  prueba('dev: sitemap.xml se conserva', fs.existsSync(path.join(tmp, 'sitemap.xml')), true);
  prueba('dev: CONSERVA demos/ y quita scripts/, README, .github, release-rules.json', ['demos', 'scripts', 'README.md', '.github', 'release-rules.json'].map((n) => fs.existsSync(path.join(tmp, n))), [true, false, false, false, false]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
// idempotencia y reemplazo de una meta robots previa (función exportada)
{
  const { inyectarNoindexDev } = require('../prepare-deploy.js');
  const tmp = sitio({ 'index.html': pag('Inicio', '  <meta name="robots" content="index, follow" />\n') });
  inyectarNoindexDev(tmp); inyectarNoindexDev(tmp);
  const h = lee(tmp, 'index.html');
  prueba('idempotente: 2 corridas → una sola meta robots, con noindex', [(h.match(/name="robots"/g) || []).length, /content="index/.test(h), (h.match(META) || []).length], [1, false, 1]);
  prueba('idempotente: un solo header X-Robots-Tag', JSON.parse(lee(tmp, 'vercel.json')).headers.filter((x) => x.headers.some((k) => k.key === 'X-Robots-Tag')).length, 1);
  fs.rmSync(tmp, { recursive: true, force: true });
}
// ── prepare-deploy: PROD
{
  const tmp = sitio(); const antes = ['index.html', 'robots.txt', 'vercel.json'].map((f) => lee(tmp, f)); const p = prepara(tmp, 'prod');
  prueba('prod: paquete indexable → sale con 0', p.status, 0);
  prueba('prod: NO modifica páginas, robots.txt ni vercel.json', ['index.html', 'robots.txt', 'vercel.json'].map((f) => lee(tmp, f)), antes);
  prueba('prod: sin meta noindex ni header X-Robots-Tag', [/noindex/i.test(lee(tmp, 'index.html')), /x-robots/i.test(lee(tmp, 'vercel.json'))], [false, false]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
const prodFalla = (nombre, extra, patron) => {
  const tmp = sitio(extra); const p = prepara(tmp, 'prod');
  prueba(`prod ABORTA: ${nombre}`, [p.status, patron.test(p.stderr)], [1, true]);
  fs.rmSync(tmp, { recursive: true, force: true });
};
prodFalla('meta noindex en una página', { 'servicios/radar.html': pag('Radar', '  <meta name="robots" content="noindex, nofollow" />\n') }, /radar\.html: meta robots noindex/);
prodFalla('header X-Robots-Tag noindex en vercel.json', { 'vercel.json': JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }] }) }, /header X-Robots-Tag noindex/);
prodFalla('robots.txt «Disallow: /»', { 'robots.txt': 'User-agent: *\nDisallow: /\nSitemap: https://x/sitemap.xml\n' }, /Disallow: \//);
prodFalla('robots.txt sin «Sitemap:»', { 'robots.txt': 'User-agent: *\nAllow: /\n' }, /Sitemap/);
prodFalla('robots.txt con «Sitemap:» distinta de robots.sitemapUrl (apex en vez de www)', { 'robots.txt': 'User-agent: *\nAllow: /\nSitemap: https://onix-ia.com/sitemap.xml\n' }, /debe referenciar https:\/\/www\.onix-ia\.com\/sitemap\.xml/);
prodFalla('sitemap.xml sin <urlset>', { 'sitemap.xml': '<html>x</html>' }, /sitemap\.xml: no es válido/);
{
  const tmp = sitio(); fs.rmSync(path.join(tmp, 'sitemap.xml')); const p = prepara(tmp, 'prod');
  prueba('prod ABORTA: falta sitemap.xml', [p.status, /sitemap\.xml: no existe/.test(p.stderr)], [1, true]); fs.rmSync(tmp, { recursive: true, force: true });
}
{
  const tmp = sitio({ 'salud.html': pag('Salud', '  <meta name="robots" content="noindex, nofollow" />\n'), 'salud/preguntas.html': pag('P', '  <meta name="robots" content="noindex" />\n') });
  const p = prepara(tmp, 'prod');
  prueba('prod: /salud y /salud/* con noindex NO abortan (robots.rutasNoindex)', p.status, 0); fs.rmSync(tmp, { recursive: true, force: true });
  const t2 = sitio({ 'saludable.html': pag('S', '  <meta name="robots" content="noindex" />\n') });
  prueba('prod ABORTA: página parecida a /salud (saludable) con noindex', prepara(t2, 'prod').status, 1); fs.rmSync(t2, { recursive: true, force: true });
}
// ── DEPLOY_ENV: sin definir = prod (opción segura); un valor inválido falla cerrado
for (const v of [undefined, '']) {
  const tmp = sitio(); const p = prepara(tmp, v);
  prueba(`DEPLOY_ENV=${JSON.stringify(v)} → se trata como prod (sin demos/, sin noindex inyectado)`, [p.status, fs.existsSync(path.join(tmp, 'demos')), lee(tmp, 'robots.txt') === ROBOTS_PROD], [0, false, true]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
for (const v of ['staging', 'PROD', 'production']) {
  const tmp = sitio(); const p = prepara(tmp, v);
  prueba(`DEPLOY_ENV=${JSON.stringify(v)} → aborta sin tocar nada`, [p.status, fs.existsSync(path.join(tmp, 'demos')), lee(tmp, 'robots.txt') === ROBOTS_PROD], [1, true, true]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
{
  const tmp = sitio(); const e = Object.assign({}, process.env, { DEPLOY_ENV: 'dev' }); delete e.GITHUB_ACTIONS;
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'prepare-deploy.js')], { cwd: tmp, encoding: 'utf8', env: e });
  prueba('sin GITHUB_ACTIONS ni --force → aborta (destructivo)', [p.status, fs.existsSync(path.join(tmp, 'demos'))], [1, true]); fs.rmSync(tmp, { recursive: true, force: true });
}
// ── verify-deploy: evaluar() puro
const V = require('../verify-deploy.js');
const home = (h, meta) => ({ status: 200, headers: h, body: pag('x', meta ? '  <meta name="robots" content="noindex, nofollow" />\n' : '') });
const rbDev = { status: 200, body: 'User-agent: *\nDisallow: /\n' };
const rbProd = { status: 200, body: ROBOTS_PROD };
const smOk = { status: 200, body: SITEMAP };
const av = (h = {}, extra = '') => ({ status: 200, headers: h, body: pag('Aviso de privacidad') + extra });
const NI = { 'x-robots-tag': 'noindex, nofollow' };
const n = (r, o) => [r.errores.length, r.avisos.length];
prueba('verify dev: header+meta+Disallow → ok', n(V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex, nofollow' }, true), aviso: av(NI), robots: rbDev, sitemap: smOk })), [0, 0]);
prueba('verify dev: sin header → error', V.evaluar('dev', { home: home({}, true), aviso: av(NI), robots: rbDev, sitemap: smOk }).errores.length, 1);
prueba('verify dev: sin meta → error', V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex' }, false), aviso: av(NI), robots: rbDev, sitemap: smOk }).errores.length, 1);
prueba('verify dev: robots.txt sin Disallow → error', V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex' }, true), aviso: av(NI), robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify dev: 401 protegido sin bypass → aviso, no error', n(V.evaluar('dev', { home: { status: 401, headers: {}, body: '' } })), [0, 1]);
prueba('verify dev: 401 con --strict → error', n(V.evaluar('dev', { home: { status: 401, headers: {}, body: '' } }, { strict: true })), [1, 0]);
prueba('verify prod: indexable, robots+sitemap, /salud 404 → ok', n(V.evaluar('prod', { home: home({}, false), aviso: av(), robots: rbProd, sitemap: smOk, extra404: { '/salud': 404 } })), [0, 0]);
prueba('verify prod: header noindex → error', V.evaluar('prod', { home: home({ 'x-robots-tag': 'noindex' }, false), aviso: av(), robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify prod: meta noindex → error', V.evaluar('prod', { home: home({}, true), aviso: av(), robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify prod: robots Disallow: / → error', V.evaluar('prod', { home: home({}, false), aviso: av(), robots: rbDev, sitemap: smOk }).errores.length, 2);
prueba('verify prod --sitemap exacta: coincide → ok', V.evaluar('prod', { home: home({}, false), aviso: av(), robots: rbProd, sitemap: smOk }, { sitemapUrl: 'https://www.onix-ia.com/sitemap.xml' }).errores.length, 0);
prueba('verify prod --sitemap exacta: robots apunta a otra URL → error', V.evaluar('prod', { home: home({}, false), aviso: av(), robots: rbProd, sitemap: smOk }, { sitemapUrl: 'https://onix-ia.com/sitemap.xml' }).errores.length, 1);
prueba('verify prod: sin sitemap → error', V.evaluar('prod', { home: home({}, false), aviso: av(), robots: rbProd, sitemap: { status: 404, body: '' } }).errores.length, 1);
prueba('verify prod: /salud responde 200 → error', V.evaluar('prod', { home: home({}, false), aviso: av(), robots: rbProd, sitemap: smOk, extra404: { '/salud': 200 } }).errores.length, 1);
prueba('verify prod: 403 → error aunque no sea --strict', V.evaluar('prod', { home: { status: 403, headers: {}, body: '' } }).errores.length, 1);

prueba('verify dev: aviso sin header noindex → error', V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex' }, true), aviso: av(), robots: rbDev, sitemap: smOk }).errores.length, 1);
prueba('verify dev: aviso con «FECHA DE VIGENCIA» → solo aviso (normal en dev)', n(V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex' }, true), aviso: av(NI, '<p>[FECHA DE VIGENCIA]</p>'), robots: rbDev, sitemap: smOk })), [0, 1]);
prueba('verify dev: /aviso-de-privacidad 404 → error', V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex' }, true), aviso: { status: 404, headers: {}, body: '' }, robots: rbDev, sitemap: smOk }).errores.length, 1);
prueba('verify dev: /sitemap.xml 404 → error', V.evaluar('dev', { home: home({ 'x-robots-tag': 'noindex' }, true), aviso: av(NI), robots: rbDev, sitemap: { status: 404, body: '' } }).errores.length, 1);
prueba('verify prod: /aviso-de-privacidad 404 → error', V.evaluar('prod', { home: home({}, false), aviso: { status: 404, headers: {}, body: '' }, robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify prod: aviso con «FECHA DE VIGENCIA» → error', V.evaluar('prod', { home: home({}, false), aviso: av({}, '<p>[Fecha de   vigencia — completar]</p>'), robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify prod: aviso con «v3-borrador» → error', V.evaluar('prod', { home: home({}, false), aviso: av({}, '<div data-version="v3-borrador"></div>'), robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify prod: aviso con noindex → error', V.evaluar('prod', { home: home({}, false), aviso: av({ 'x-robots-tag': 'noindex' }), robots: rbProd, sitemap: smOk }).errores.length, 1);
prueba('verify prod: /robots.txt 404 → error', V.evaluar('prod', { home: home({}, false), aviso: av(), robots: { status: 404, body: '' }, sitemap: smOk }).errores.length, 1);
prueba('verify prod: 401 con --tolerar-proteccion → aviso, no error', n(V.evaluar('prod', { home: { status: 401, headers: {}, body: '' } }, { tolerarProteccion: true })), [0, 1]);
prueba('verify prod: 401 con --tolerar-proteccion --strict → error', n(V.evaluar('prod', { home: { status: 401, headers: {}, body: '' } }, { tolerarProteccion: true, strict: true })), [1, 0]);
// H-39 en el paquete prod (defensa en profundidad de prepare-deploy)
for (const [n2, extra] of [['«FECHA DE VIGENCIA» en una página', { 'aviso-de-privacidad.html': pag('Aviso', '  <mark>[FECHA DE VIGENCIA — completar]</mark>\n') }], ['«v3-borrador» en una página', { 'index.html': pag('Inicio', '  <input value="v3-borrador">\n') }], ['«borrador» en robots.txt', { 'robots.txt': ROBOTS_PROD + '# v3-borrador\n' }]]) {
  const tmp = sitio(extra); const p = prepara(tmp, 'prod');
  prueba(`prod ABORTA (H-39): ${n2}`, [p.status, /marcador pendiente/.test(p.stderr)], [1, true]); fs.rmSync(tmp, { recursive: true, force: true });
}
{
  const tmp = sitio({ 'demos/aprobar.html': pag('Demo', '  <button>Aprobar borrador</button>\n') }); const p = prepara(tmp, 'prod');
  prueba('prod: «Aprobar borrador» en demos/ (se quita del paquete) NO aborta', p.status, 0); fs.rmSync(tmp, { recursive: true, force: true });
}

// ── garantía «demos/ solo en DEV» (la exención robots.rutasExentasDemos del check 04 depende de que demos/ no llegue a PROD)
{
  const lista = (d, base = d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) lista(f, base, acc); else acc.push(path.relative(base, f).split(path.sep).join('/')); } return acc; };
  const fake = { 'demos/x.html': pag('Demo', '  <p>demo con noindex</p>\n', '<meta name="robots" content="noindex">'), 'demos/sub/y.html': pag('Demo 2'), 'demos/assets/a.png': 'PNG', 'demos/README.md': 'interno' };
  {
    const tmp = sitio(fake); const p = prepara(tmp, 'prod');
    const rest = lista(tmp);
    prueba('PROD: con demos/x.html (+ subcarpetas, assets, README) en el fuente, el paquete NO contiene ningún archivo de demos/', [p.status, rest.filter((f) => f === 'demos' || f.startsWith('demos/')).length, rest.includes('index.html')], [0, 0, true]);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  {
    const tmp = sitio(fake); const p = prepara(tmp, 'dev');
    const rest = lista(tmp);
    prueba('DEV: el paquete CONTIENE demos/ (4 archivos) y conserva index.html', [p.status, rest.filter((f) => f === 'demos' || f.startsWith('demos/')).length, rest.includes('index.html')], [0, 4, true]);
    const htmlsDemos = rest.filter((f) => /^demos\/.*\.html$/.test(f));
    prueba('DEV: cada .html de demos/ trae UNA sola meta robots noindex, nofollow', htmlsDemos.map((f) => (lee(tmp, f).match(META) || []).length + '/' + (lee(tmp, f).match(/<meta\b[^>]*name="robots"/gi) || []).length), htmlsDemos.map(() => '1/1'));
    prueba('DEV: robots.txt con «Disallow: /» y header X-Robots-Tag en vercel.json', [/^Disallow:\s*\/\s*$/m.test(lee(tmp, 'robots.txt')), JSON.stringify(JSON.parse(lee(tmp, 'vercel.json')).headers).includes('noindex, nofollow')], [true, true]);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const ig = fs.readFileSync(path.join(raiz, '.vercelignore'), 'utf8').split(/\r?\n/).map((l) => l.trim());
  prueba('.vercelignore lista «demos»', ig.includes('demos') || ig.includes('demos/'), true);
  const PD = require('../prepare-deploy.js');
  prueba('prepare-deploy: la lista de PROD incluye «demos» y la de DEV no', [PD.NO_PUBLICOS_PROD.includes('demos'), PD.NO_PUBLICOS_SIEMPRE.includes('demos')], [true, false]);
}

// ── verify-deploy: CLI contra un servidor HTTP local (extremo a extremo con prepare-deploy)
function servir(dir, headersExtra) {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; else if (!path.extname(u)) u += '.html';
      const f = path.join(dir, u);
      if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end('no'); }
      const h = Object.assign({}, headersExtra); if (/\.html$/.test(f)) h['content-type'] = 'text/html'; r.writeHead(200, h); r.end(fs.readFileSync(f));
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}
function cli(args) {
  return new Promise((ok) => { const p = spawn(process.execPath, [path.join(raiz, 'scripts', 'verify-deploy.js'), ...args], { env: process.env }); let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (o += d)); p.on('close', (c) => ok({ c, o })); });
}
(async () => {
  const dev = sitio(); prepara(dev, 'dev');
  const vjDev = JSON.parse(lee(dev, 'vercel.json')); const hdrDev = { 'x-robots-tag': vjDev.headers.find((h) => h.headers[0].key === 'X-Robots-Tag').headers[0].value };
  let s = await servir(dev, hdrDev); let url = `http://127.0.0.1:${s.address().port}`;
  let r = await cli(['--env', 'dev', '--url', url]); prueba('CLI e2e: paquete DEV de prepare-deploy → verify dev OK', r.c, 0);
  r = await cli(['--env', 'prod', '--url', url, '--strict']); prueba('CLI e2e: ese mismo paquete DEV NO pasa la verificación de PROD', r.c, 1); s.close();
  s = await servir(dev, {}); url = `http://127.0.0.1:${s.address().port}`;
  r = await cli(['--env', 'dev', '--url', url]); prueba('CLI e2e: DEV sin header (solo meta+robots) → verify dev FALLA', r.c, 1); s.close();
  const prod = sitio(); prepara(prod, 'prod');
  s = await servir(prod, {}); url = `http://127.0.0.1:${s.address().port}`;
  r = await cli(['--env', 'prod', '--url', url, '--strict', '--404', '/salud']); prueba('CLI e2e: paquete PROD de prepare-deploy → verify prod OK', r.c, 0);
  r = await cli(['--env', 'dev', '--url', url]); prueba('CLI e2e: paquete PROD NO pasa la verificación de DEV', r.c, 1); s.close();
  // 200 en las tres URLs del MISMO deployment (servidor local que emula cleanUrls: /aviso-de-privacidad → aviso-de-privacidad.html)
  const si = (x) => /^  200 \/aviso-de-privacidad$/m.test(x) && /^  200 \/robots\.txt$/m.test(x) && /^  200 \/sitemap\.xml$/m.test(x);
  s = await servir(prod, {}); url = `http://127.0.0.1:${s.address().port}`;
  r = await cli(['--env', 'prod', '--url', url, '--strict']); prueba('CLI e2e PROD: 200 en /aviso-de-privacidad, /robots.txt y /sitemap.xml (salida lo muestra)', [r.c, si(r.o)], [0, true]);
  s.close();
  for (const [quitar, patron] of [['aviso-de-privacidad.html', /404 \/aviso-de-privacidad/], ['robots.txt', /404 \/robots\.txt/], ['sitemap.xml', /404 \/sitemap\.xml/]]) {
    const pk = sitio(); prepara(pk, 'prod'); fs.rmSync(path.join(pk, quitar));
    const s2 = await servir(pk, {}); const u2 = `http://127.0.0.1:${s2.address().port}`;
    const r2 = await cli(['--env', 'prod', '--url', u2, '--strict']); prueba(`CLI e2e PROD NEGATIVO: falta ${quitar} → FALLA (404 visible)`, [r2.c, patron.test(r2.o)], [1, true]);
    s2.close(); fs.rmSync(pk, { recursive: true, force: true });
  }
  { const pk = sitio(); prepara(pk, 'dev'); fs.rmSync(path.join(pk, 'sitemap.xml'));
    const vjd = JSON.parse(lee(pk, 'vercel.json')); const hd = { 'x-robots-tag': vjd.headers.find((h) => h.headers[0].key === 'X-Robots-Tag').headers[0].value };
    const s2 = await servir(pk, hd); const r2 = await cli(['--env', 'dev', '--url', `http://127.0.0.1:${s2.address().port}`]); prueba('CLI e2e DEV NEGATIVO: falta sitemap.xml → FALLA', r2.c, 1); s2.close(); fs.rmSync(pk, { recursive: true, force: true }); }
  { const pk = sitio(); prepara(pk, 'dev');
    const vjd = JSON.parse(lee(pk, 'vercel.json')); const hd = { 'x-robots-tag': vjd.headers.find((h) => h.headers[0].key === 'X-Robots-Tag').headers[0].value };
    const s2 = await servir(pk, hd); const r2 = await cli(['--env', 'dev', '--url', `http://127.0.0.1:${s2.address().port}`]); prueba('CLI e2e DEV: 200 en las 4 rutas + noindex → OK', [r2.c, si(r2.o)], [0, true]); s2.close(); fs.rmSync(pk, { recursive: true, force: true }); }
  r = await cli(['--env', 'otro', '--url', url]); prueba('CLI: --env inválido → código 2', r.c, 2);
  [dev, prod].forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
  console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron.` : '\n✔ Todas las pruebas de deploy-noindex pasaron.');
  process.exit(fallos ? 1 : 0);
})();
