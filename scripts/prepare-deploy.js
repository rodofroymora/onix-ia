#!/usr/bin/env node
'use strict';
/**
 * Deja en el directorio de trabajo SOLO los archivos públicos del sitio antes de `vercel build`.
 * Motivo: vercel.json usa outputDirectory "." → todo lo que esté en la raíz se publicaría
 * (scripts/, release-rules.json, workflows...). Este script es DESTRUCTIVO:
 * solo corre en GitHub Actions (o con --force sobre un clon desechable).
 *
 * Entorno (variable DEPLOY_ENV; si no se define se asume "prod", que es la opción segura):
 *   · DEPLOY_ENV=dev  → el paquete INCLUYE demos/ y todas sus páginas .html salen con
 *                       <meta name="robots" content="noindex, nofollow">; además el paquete trae robots.txt con
 *                       «Disallow: /» y el header X-Robots-Tag «noindex, nofollow» en vercel.json. La línea «demos»
 *                       se quita de .vercelignore SOLO en el paquete (el archivo del repo no cambia).
 *   · DEPLOY_ENV=prod → demos/ se elimina por completo, «demos» queda en .vercelignore y el script VERIFICA que el
 *                       paquete no contenga ninguna ruta demos/ (si la hay, falla antes de desplegar).
 * Cualquier otro valor de DEPLOY_ENV es un error.
 */
const fs = require('fs');
const path = require('path');

// Archivos que nunca se publican en ningún entorno.
const NO_PUBLICOS_SIEMPRE = ['.github', 'scripts', 'release-rules.json', 'README.md', 'CONTRIBUTING.md', '.gitignore'];
// `demos/` (prefijo exacto, con barra) solo se publica en DEV, siempre con noindex.
const DIR_DEMOS = 'demos';
const NO_PUBLICOS_PROD = NO_PUBLICOS_SIEMPRE.concat([DIR_DEMOS]);
const META_NOINDEX = '<meta name="robots" content="noindex, nofollow" />';
const META_ROBOTS_RE = /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/i;
const ROBOTS_DEV = 'User-agent: *\nDisallow: /\n';
const HEADER_NOINDEX = { source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] };

function listarHtml(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listarHtml(p, acc);
    else if (/\.html$/i.test(e.name)) acc.push(p);
  }
  return acc.sort();
}

/** Todas las rutas del paquete (relativas, con "/") cuyo primer segmento es exactamente `demos`. */
function rutasDemos(root) {
  const acc = [];
  const rec = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (rel === DIR_DEMOS || rel.startsWith(DIR_DEMOS + '/')) acc.push(rel);
      if (e.isDirectory()) rec(p);
    }
  };
  rec(root);
  return acc;
}

/** DEV: noindex en todas las páginas de demos/, robots.txt «Disallow: /», header en vercel.json y .vercelignore sin «demos». */
/* ── Enlace del servicio a su demo (SOLO DEV) ───────────────────────────────
   En producción `demos/` se excluye del paquete, así que un enlace fijo en el
   HTML quedaría roto. Por eso se inyecta aquí, igual que el noindex: el
   repositorio no lo lleva y el paquete DEV sí. */
const DEMO_POR_SERVICIO = {
  'contabilidad-asistida.html': ['/demos/contabilidad-asistida', 'Contabilidad Asistida'],
  'documentos-vivos.html':      ['/demos/documentos-vivos', 'Base de Conocimiento Inteligente'],
  'radar-de-leads.html':        ['/demos/radar-de-leads', 'Radar de Leads'],
  'agentes-de-operacion.html':  ['/demos/agentes-de-operacion', 'Agentes de Operación'],
  'asistentes-whatsapp-y-voz.html': ['/demos/asistentes-whatsapp-voz', 'Asistentes de WhatsApp y Voz'],
};
const ANCLA_TRY = '<section class="sv-sec band sv-try"';

function enlaceDemo(href, nombre) {
  return '\n<section class="sv-sec sv-verdemo" aria-labelledby="verdemo-t">\n' +
    '  <div class="wrap">\n' +
    '    <div class="sv-verdemo__caja">\n' +
    '      <div>\n' +
    '        <p class="sv-eyebrow">Demostración completa</p>\n' +
    '        <h2 id="verdemo-t" class="sv-verdemo__t">Ve ' + nombre + ' funcionando de principio a fin.</h2>\n' +
    '        <p class="sv-verdemo__p">Un recorrido con datos de ejemplo, donde se ve cada paso del sistema.</p>\n' +
    '      </div>\n' +
    '      <a class="sv-verdemo__a" href="' + href + '">Abrir la demostración' +
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>\n';
}

/** Inserta el enlace justo después del bloque «Pruébalo» de cada página de servicio. */
function vincularDemosDev(root) {
  const puestos = [];
  for (const [archivo, [href, nombre]] of Object.entries(DEMO_POR_SERVICIO)) {
    const f = path.join(root, 'servicios', archivo);
    if (!fs.existsSync(f)) continue;
    let html = fs.readFileSync(f, 'utf8');
    if (html.includes('sv-verdemo')) continue;
    const i = html.indexOf(ANCLA_TRY);
    if (i === -1) { console.log(`  · ${archivo}: sin bloque «Pruébalo»; no se enlaza`); continue; }
    const fin = html.indexOf('</section>', i);
    if (fin === -1) { console.log(`  · ${archivo}: bloque «Pruébalo» sin cierre; no se enlaza`); continue; }
    const corte = fin + '</section>'.length;
    fs.writeFileSync(f, html.slice(0, corte) + enlaceDemo(href, nombre) + html.slice(corte));
    puestos.push(archivo);
  }
  return puestos;
}

function prepararDemosDev(root) {
  const resumen = { demosHtml: 0 };
  for (const f of listarHtml(path.join(root, DIR_DEMOS))) {
    let h = fs.readFileSync(f, 'utf8');
    if (META_ROBOTS_RE.test(h)) h = h.replace(META_ROBOTS_RE, META_NOINDEX);
    else if (/<head\b[^>]*>/i.test(h)) h = h.replace(/<head\b[^>]*>/i, (m) => m + '\n  ' + META_NOINDEX);
    else throw new Error(`${path.relative(root, f)}: no tiene <head>; no se puede inyectar noindex.`);
    fs.writeFileSync(f, h);
    resumen.demosHtml++;
  }
  fs.writeFileSync(path.join(root, 'robots.txt'), ROBOTS_DEV);
  const vj = path.join(root, 'vercel.json');
  const v = fs.existsSync(vj) ? JSON.parse(fs.readFileSync(vj, 'utf8')) : {};
  v.headers = (Array.isArray(v.headers) ? v.headers : []).filter((h) => !(h.headers || []).some((kv) => /^x-robots-tag$/i.test(kv.key)));
  v.headers.push(JSON.parse(JSON.stringify(HEADER_NOINDEX)));
  fs.writeFileSync(vj, JSON.stringify(v, null, 2) + '\n');
  const vi = path.join(root, '.vercelignore');
  if (fs.existsSync(vi)) {
    const lineas = fs.readFileSync(vi, 'utf8').split(/\r?\n/).filter((l) => !/^\/?demos\/?\s*$/.test(l.trim()));
    fs.writeFileSync(vi, lineas.join('\n').replace(/\n*$/, '\n'));
  }
  return resumen;
}

/** PROD: el paquete no debe contener demos/ y .vercelignore debe seguir excluyéndolo. Devuelve errores[]. */
function verificarProd(root) {
  const errs = [];
  for (const r of rutasDemos(root)) errs.push(`${r}: demos/ no puede estar en el paquete de PRODUCCIÓN.`);
  const vi = path.join(root, '.vercelignore');
  if (fs.existsSync(vi) && !fs.readFileSync(vi, 'utf8').split(/\r?\n/).some((l) => /^\/?demos\/?\s*$/.test(l.trim()))) errs.push('.vercelignore: debe excluir «demos» en PRODUCCIÓN.');
  return errs;
}

/** Orquesta el paquete. Devuelve { removidos, resumen, errores }. No hace process.exit (se usa en pruebas). */
function construirPaquete(root, env) {
  if (!['dev', 'prod'].includes(env)) throw new Error(`DEPLOY_ENV debe ser "dev" o "prod" (valor: ${JSON.stringify(env)}).`);
  const removidos = [];
  for (const n of env === 'dev' ? NO_PUBLICOS_SIEMPRE : NO_PUBLICOS_PROD) {
    const p = path.join(root, n);
    if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removidos.push(n); }
  }
  for (const n of fs.readdirSync(root)) if (/^\.env/.test(n)) { fs.rmSync(path.join(root, n), { force: true }); removidos.push(n); }
  if (env === 'dev') {
    const resumen = prepararDemosDev(root);
    const enlazados = vincularDemosDev(root);
    console.log(`✔ DEV: enlace a la demo añadido en ${enlazados.length} página(s) de servicio.`);
    return { removidos, resumen, errores: [] };
  }
  return { removidos, resumen: null, errores: verificarProd(root) };
}

module.exports = { NO_PUBLICOS_SIEMPRE, NO_PUBLICOS_PROD, construirPaquete, prepararDemosDev, verificarProd, rutasDemos, listarHtml };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  if (process.env.GITHUB_ACTIONS !== 'true' && !process.argv.includes('--force')) {
    console.error('✖ prepare-deploy.js borra archivos del directorio actual. Solo corre en GitHub Actions o con --force en un clon desechable.');
    process.exit(1);
  }
  const env = process.env.DEPLOY_ENV || 'prod';
  if (!['dev', 'prod'].includes(env)) {
    console.error('✖ DEPLOY_ENV debe ser "dev" o "prod" (si no se define, se asume "prod").');
    process.exit(1);
  }
  const r = construirPaquete(root, env);
  r.removidos.forEach((n) => console.log('− removido del paquete de deploy: ' + n));
  if (r.errores.length) {
    r.errores.forEach((e) => console.error('✖ ' + e));
    console.error('✖ El paquete de PRODUCCIÓN no cumple: se aborta antes de desplegar.');
    process.exit(1);
  }
  if (env === 'dev') console.log(`✔ DEV: demos/ incluido con noindex (${r.resumen.demosHtml} página(s) HTML), robots.txt «Disallow: /» y header X-Robots-Tag.`);
  else console.log('✔ PROD: el paquete no contiene demos/.');
  console.log('✔ Paquete de deploy listo (solo archivos públicos del sitio).');
}
