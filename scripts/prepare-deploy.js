#!/usr/bin/env node
'use strict';
/**
 * Prepara el paquete de deploy: deja SOLO los archivos públicos del sitio y aplica la política de indexación del
 * ENTORNO. Se ejecuta antes de `vercel build`. Es DESTRUCTIVO: solo corre en GitHub Actions o con --force sobre un
 * clon desechable.
 *
 * El FUENTE del repo es indexable (production-ready) en dev y en main. La diferencia entre entornos se aplica aquí,
 * al desplegar, con la variable DEPLOY_ENV (si no se define se asume "prod", la opción segura; cualquier otro valor
 * distinto de "dev" o "prod" es un error y el script falla):
 *   · DEPLOY_ENV=dev  → INCLUYE demos/ e inyecta noindex en el paquete: robots.txt con «Disallow: /», header X-Robots-Tag
 *                       «noindex, nofollow» en vercel.json y <meta name="robots" content="noindex, nofollow"> en cada
 *                       página .html (también las de demos/). La línea «demos» se quita de .vercelignore SOLO dentro del
 *                       paquete (el archivo del repo no cambia). No modifica el repo (solo el directorio de trabajo del CI).
 *   · DEPLOY_ENV=prod → demos/ se elimina por completo; NO inyecta nada y VERIFICA que el paquete no contenga ninguna ruta
 *                       demos/ (prefijo exacto en la raíz), que .vercelignore siga excluyendo «demos» y que sea indexable
 *                       (sin meta/header noindex, robots.txt sin «Disallow: /» y con «Sitemap:», sitemap.xml presente);
 *                       si no, falla antes de desplegar. Única excepción de noindex: la ruta /salud (robots.rutasNoindex).
 */
const fs = require('fs');
const path = require('path');

// Archivos que nunca se publican en ningún entorno.
const NO_PUBLICOS_SIEMPRE = ['.github', 'scripts', 'release-rules.json', 'README.md', 'CONTRIBUTING.md', '.gitignore'];
// `demos/` (prefijo exacto, con barra) solo se publica en DEV, siempre con noindex; en PROD se elimina.
const DIR_DEMOS = 'demos';
const NO_PUBLICOS_PROD = NO_PUBLICOS_SIEMPRE.concat([DIR_DEMOS]);
const NO_PUBLICOS = NO_PUBLICOS_PROD;   // lista de PROD (compatibilidad)
const LINEA_DEMOS_RE = /^\/?demos\/?\s*$/;
const META_NOINDEX = '<meta name="robots" content="noindex, nofollow" />';
const ROBOTS_DEV = 'User-agent: *\nDisallow: /\n';
const HEADER_NOINDEX = { source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] };
const SKIP = new Set(['node_modules', '.git', '.vercel']);

function listarHtml(root, dir = root, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listarHtml(root, p, acc);
    else if (/\.html$/i.test(e.name)) acc.push(p);
  }
  return acc.sort();
}
/** "index.html" → "/", "salud.html" → "/salud", "salud/x.html" → "/salud/x" (como cleanUrls). */
function urlDe(root, f) {
  let r = path.relative(root, f).split(path.sep).join('/').replace(/\.html$/i, '');
  if (r === 'index') return '/';
  if (r.endsWith('/index')) return '/' + r.slice(0, -6);
  return '/' + r;
}
const enRuta = (url, ruta) => url === ruta || url.startsWith(ruta + '/');
const META_ROBOTS_RE = /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/i;

/** DEV: inyecta noindex en el paquete. Idempotente. Devuelve un resumen. */
function inyectarNoindexDev(root) {
  const resumen = { paginas: 0, robots: false, header: false };
  for (const f of listarHtml(root)) {
    let h = fs.readFileSync(f, 'utf8');
    if (META_ROBOTS_RE.test(h)) h = h.replace(META_ROBOTS_RE, META_NOINDEX);
    else if (/<head\b[^>]*>/i.test(h)) h = h.replace(/<head\b[^>]*>/i, (m) => m + '\n  ' + META_NOINDEX);
    else throw new Error(`${path.relative(root, f)}: no tiene <head>; no se puede inyectar noindex.`);
    fs.writeFileSync(f, h);
    resumen.paginas++;
  }
  fs.writeFileSync(path.join(root, 'robots.txt'), ROBOTS_DEV); resumen.robots = true;
  const vj = path.join(root, 'vercel.json');
  const v = fs.existsSync(vj) ? JSON.parse(fs.readFileSync(vj, 'utf8')) : {};
  v.headers = (Array.isArray(v.headers) ? v.headers : []).filter((h) => !(h.headers || []).some((kv) => /^x-robots-tag$/i.test(kv.key)));
  v.headers.push(JSON.parse(JSON.stringify(HEADER_NOINDEX)));
  fs.writeFileSync(vj, JSON.stringify(v, null, 2) + '\n'); resumen.header = true;
  // .vercelignore del PAQUETE DEV sin «demos» (el del repo no cambia): si vercel lo aplicara, no debe bloquear las demos.
  const vi = path.join(root, '.vercelignore');
  if (fs.existsSync(vi)) {
    const lineas = fs.readFileSync(vi, 'utf8').split(/\r?\n/).filter((l) => !LINEA_DEMOS_RE.test(l.trim()));
    fs.writeFileSync(vi, lineas.join('\n').replace(/\n*$/, '\n'));
  }
  resumen.demosHtml = listarHtml(path.join(root, DIR_DEMOS)).length;
  return resumen;
}

/** Todas las rutas del paquete (relativas, con "/") cuyo primer segmento es exactamente `demos` (no «demos-x/» ni «sub/demos/»). */
function rutasDemos(root) {
  const acc = [];
  const rec = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (rel === DIR_DEMOS || rel.startsWith(DIR_DEMOS + '/')) acc.push(rel);
      if (e.isDirectory()) rec(p);
    }
  };
  rec(root);
  return acc;
}

/** PROD: el paquete no debe contener demos/ y .vercelignore debe seguir excluyéndolo. Devuelve errores[]. */
function verificarDemosProd(root) {
  const errs = [];
  for (const r of rutasDemos(root)) errs.push(`${r}: demos/ no puede estar en el paquete de PRODUCCIÓN.`);
  const vi = path.join(root, '.vercelignore');
  if (fs.existsSync(vi) && !fs.readFileSync(vi, 'utf8').split(/\r?\n/).some((l) => LINEA_DEMOS_RE.test(l.trim()))) errs.push('.vercelignore: debe excluir «demos» en PRODUCCIÓN.');
  return errs;
}

/** PROD: verifica que el paquete sea indexable. `rutasNoindex`: rutas con noindex permitido (solo /salud); `sitemapUrl`: la URL exacta
 *  que robots.txt debe referenciar (release-rules.json → robots.sitemapUrl; si es null, cualquier «Sitemap:»). Devuelve errores[]. */
function verificarProd(root, rutasNoindex = [], sitemapUrl = null, marcadores = []) {
  const errs = verificarDemosProd(root);
  const permitida = (url) => rutasNoindex.some((r) => enRuta(url, r));
  for (const f of listarHtml(root)) {
    const m = fs.readFileSync(f, 'utf8').match(META_ROBOTS_RE);
    if (m && /noindex/i.test(m[0]) && !permitida(urlDe(root, f))) errs.push(`${path.relative(root, f)}: meta robots noindex en producción.`);
  }
  const vj = path.join(root, 'vercel.json');
  if (fs.existsSync(vj)) {
    const v = JSON.parse(fs.readFileSync(vj, 'utf8'));
    for (const h of v.headers || []) for (const kv of h.headers || []) {
      if (/^x-robots-tag$/i.test(kv.key) && /noindex/i.test(kv.value) && !rutasNoindex.some((r) => [r, r + '/(.*)', r + '/:path*'].includes(h.source))) errs.push(`vercel.json: header X-Robots-Tag noindex en producción (source ${JSON.stringify(h.source)}).`);
    }
  }
  const rt = path.join(root, 'robots.txt');
  if (!fs.existsSync(rt)) errs.push('robots.txt: no existe (debe permitir rastreo y referenciar el sitemap).');
  else {
    let ua = false, sitemap = false;
    const urls = [];
    for (const l of fs.readFileSync(rt, 'utf8').split(/\r?\n/)) {
      const s = l.replace(/#.*/, '').trim();
      if (/^user-agent:\s*\*/i.test(s)) ua = true;
      else if (/^user-agent:/i.test(s)) ua = false;
      else if (ua && /^disallow:\s*\/\s*$/i.test(s)) errs.push('robots.txt: «Disallow: /» en producción.');
      const m = s.match(/^sitemap:\s*(\S+)/i);
      if (m) { sitemap = true; urls.push(m[1]); }
    }
    if (!sitemap) errs.push('robots.txt: falta la línea «Sitemap:».');
    else if (sitemapUrl && !urls.includes(sitemapUrl)) errs.push(`robots.txt: debe referenciar ${sitemapUrl} (release-rules.json → robots.sitemapUrl); tiene ${urls.join(', ')}.`);
  }
  // H-39: ningún marcador pendiente («FECHA DE VIGENCIA», «borrador»…) en las páginas del paquete, sitemap.xml ni robots.txt (demos/ ya no está en el paquete).
  const lista = marcadores.map((m) => ({ t: m.texto, re: new RegExp(String(m.texto).trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:\\s|&nbsp;|&#160;|&#xa0;)+'), 'iu') }));
  for (const f of [...listarHtml(root), path.join(root, 'sitemap.xml'), path.join(root, 'robots.txt')]) {
    if (!fs.existsSync(f)) continue;
    const raw = fs.readFileSync(f, 'utf8');
    for (const { t, re } of lista) { const m = re.exec(raw); if (m) errs.push(`${path.relative(root, f)}:${raw.slice(0, m.index).split('\n').length}: marcador pendiente «${m[0]}» (regla «${t}») en producción.`); }
  }
  const sm = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(sm)) errs.push('sitemap.xml: no existe.');
  else if (!/<(urlset|sitemapindex)\b/i.test(fs.readFileSync(sm, 'utf8'))) errs.push('sitemap.xml: no es válido (falta <urlset>).');
  return errs;
}

function reglasDe(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'release-rules.json'), 'utf8')); } catch (_) { return {}; }
}

/** Orquesta el paquete. Devuelve { removidos, resumen, errores }. No hace process.exit (se usa en pruebas). */
function construirPaquete(root, env) {
  if (!['dev', 'prod'].includes(env)) throw new Error(`DEPLOY_ENV debe ser "dev" o "prod" (valor: ${JSON.stringify(env)}).`);
  const reglas = env === 'prod' ? reglasDe(root) : {};   // se lee ANTES de borrar release-rules.json
  const robotsCfg = reglas.robots || {};
  const marcadores = (reglas.bloqueosSoloMain && reglas.bloqueosSoloMain.marcadores) || [];
  const removidos = [];
  for (const n of env === 'dev' ? NO_PUBLICOS_SIEMPRE : NO_PUBLICOS_PROD) {
    const p = path.join(root, n);
    if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removidos.push(n); }
  }
  for (const n of fs.readdirSync(root)) if (/^\.env/.test(n)) { fs.rmSync(path.join(root, n), { force: true }); removidos.push(n); }
  if (env === 'dev') return { removidos, resumen: inyectarNoindexDev(root), errores: [] };
  return { removidos, resumen: null, errores: verificarProd(root, robotsCfg.rutasNoindex || [], robotsCfg.sitemapUrl || null, marcadores) };
}

module.exports = { NO_PUBLICOS, NO_PUBLICOS_SIEMPRE, NO_PUBLICOS_PROD, inyectarNoindexDev, verificarProd, verificarDemosProd, rutasDemos, construirPaquete, listarHtml, urlDe };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  if (process.env.GITHUB_ACTIONS !== 'true' && !process.argv.includes('--force')) {
    console.error('✖ prepare-deploy.js borra archivos del directorio actual. Solo corre en GitHub Actions o con --force en un clon desechable.');
    process.exit(1);
  }
  const env = process.env.DEPLOY_ENV || 'prod';   // sin definir = prod (opción segura: sin demos/ y con verificación de indexación)
  if (!['dev', 'prod'].includes(env)) {
    console.error('✖ DEPLOY_ENV debe ser "dev" o "prod" (si no se define, se asume "prod").');
    process.exit(1);
  }
  const r = construirPaquete(root, env);
  r.removidos.forEach((n) => console.log('− removido del paquete de deploy: ' + n));
  if (r.errores.length) {
    r.errores.forEach((e) => console.error('✖ ' + e));
    console.error('✖ El paquete de PRODUCCIÓN no cumple (indexable y sin demos/): se aborta antes de desplegar.');
    process.exit(1);
  }
  if (env === 'dev') console.log(`✔ DEV: demos/ incluido y noindex inyectado (${r.resumen.paginas} página(s), ${r.resumen.demosHtml} de demos/; robots.txt «Disallow: /», header X-Robots-Tag en vercel.json).`);
  else console.log('✔ PROD: paquete verificado (sin demos/, sin noindex, robots.txt con Sitemap, sitemap.xml presente).');
  console.log('✔ Paquete de deploy listo (solo archivos públicos del sitio).');
}
