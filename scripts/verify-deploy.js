#!/usr/bin/env node
'use strict';
/**
 * Verificación POSTERIOR al deploy de la política de indexación (solo lectura: peticiones GET).
 *   node verify-deploy.js --env dev  --url https://<deploy-dev>        [--strict]
 *   node verify-deploy.js --env prod --url https://www.onix-ia.com     [--strict] [--sitemap <URL exacta>] [--404 /salud ...]
 * Variable opcional BYPASS_SECRET: se envía como cabecera x-vercel-protection-bypass (deployments protegidos de Vercel).
 *
 *  dev  → la home debe traer el header X-Robots-Tag con noindex Y <meta name="robots" content="…noindex…">;
 *         /robots.txt debe tener «Disallow: /».
 *  prod → la home NO debe traer X-Robots-Tag noindex ni meta noindex; /robots.txt sin «Disallow: /» y con «Sitemap:»;
 *         /sitemap.xml 200 con <urlset>; cada ruta de --404 debe responder 404.
 * Si el deployment está protegido (401/403) y no hay BYPASS_SECRET, en dev se avisa (::warning::) y NO falla, salvo --strict;
 * en prod 401/403 siempre falla. Código de salida: 0 ok, 1 incumple, 2 uso incorrecto.
 */
const META_ROBOTS_RE = /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/gi;
const noindexEnMeta = (html) => (String(html).match(META_ROBOTS_RE) || []).some((m) => /noindex/i.test(m));
const noindexEnHeader = (h) => /noindex/i.test(String((h && (h['x-robots-tag'] || h['X-Robots-Tag'])) || ''));
function robotsInfo(txt) {
  let ua = false, disallowTodo = false, sitemap = false;
  const urls = [];
  for (const l of String(txt).split(/\r?\n/)) {
    const s = l.replace(/#.*/, '').trim();
    if (/^user-agent:\s*\*/i.test(s)) ua = true;
    else if (/^user-agent:/i.test(s)) ua = false;
    else if (ua && /^disallow:\s*\/\s*$/i.test(s)) disallowTodo = true;
    const m = s.match(/^sitemap:\s*(\S+)/i);
    if (m) { sitemap = true; urls.push(m[1]); }
  }
  return { disallowTodo, sitemap, urls };
}

/** r = { home:{status,headers,body}, robots:{status,body}, sitemap:{status,body}, extra404:{ruta:status} }. Devuelve { errores, avisos }. */
function evaluar(env, r, opciones = {}) {
  const errores = [], avisos = [];
  const protegido = r.home && [401, 403].includes(r.home.status);
  if (protegido) {
    const msg = `la home respondió ${r.home.status} (deployment protegido): no se puede verificar la política de indexación sin BYPASS_SECRET.`;
    if (env === 'dev' && !opciones.strict) avisos.push(msg); else errores.push(msg);
    return { errores, avisos };
  }
  if (!r.home || r.home.status !== 200) { errores.push(`la home no respondió 200 (estado ${r.home && r.home.status}).`); return { errores, avisos }; }
  const hdr = noindexEnHeader(r.home.headers), meta = noindexEnMeta(r.home.body);
  const ri = r.robots && r.robots.status === 200 ? robotsInfo(r.robots.body) : null;
  if (env === 'dev') {
    if (!hdr) errores.push('DEV: falta el header X-Robots-Tag noindex en la home.');
    if (!meta) errores.push('DEV: falta <meta name="robots" content="noindex…"> en la home.');
    if (!ri) errores.push(`DEV: /robots.txt no respondió 200 (estado ${r.robots && r.robots.status}).`);
    else if (!ri.disallowTodo) errores.push('DEV: /robots.txt debe tener «Disallow: /».');
  } else {
    if (hdr) errores.push('PROD: la home trae X-Robots-Tag noindex.');
    if (meta) errores.push('PROD: la home tiene <meta name="robots" content="noindex…">.');
    if (!ri) errores.push(`PROD: /robots.txt no respondió 200 (estado ${r.robots && r.robots.status}).`);
    else {
      if (ri.disallowTodo) errores.push('PROD: /robots.txt tiene «Disallow: /».');
      if (!ri.sitemap) errores.push('PROD: /robots.txt no referencia el sitemap.');
      else if (opciones.sitemapUrl && !ri.urls.includes(opciones.sitemapUrl)) errores.push(`PROD: /robots.txt debe referenciar ${opciones.sitemapUrl} (tiene ${ri.urls.join(', ')}).`);
    }
    if (!r.sitemap || r.sitemap.status !== 200 || !/<urlset\b/i.test(r.sitemap.body || '')) errores.push(`PROD: /sitemap.xml no es válido (estado ${r.sitemap && r.sitemap.status}).`);
    for (const [ruta, st] of Object.entries(r.extra404 || {})) if (st !== 404) errores.push(`PROD: ${ruta} debería responder 404 (estado ${st}).`);
  }
  return { errores, avisos };
}

async function obtener(base, ruta, bypass) {
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
  const res = await fetch(new URL(ruta, base), { redirect: 'follow', headers });
  const h = {}; res.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
  return { status: res.status, headers: h, body: await res.text() };
}

module.exports = { evaluar, robotsInfo, noindexEnMeta, noindexEnHeader };

if (require.main === module) {
  const a = process.argv.slice(2);
  const val = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const env = val('--env'), url = val('--url');
  if (!['dev', 'prod'].includes(env) || !url) { console.error('Uso: node verify-deploy.js --env dev|prod --url <url> [--strict] [--404 /ruta]...'); process.exit(2); }
  const extra = a.reduce((acc, x, i) => (x === '--404' ? acc.concat(a[i + 1]) : acc), []);
  const bypass = process.env.BYPASS_SECRET || '';
  (async () => {
    const r = { extra404: {} };
    r.home = await obtener(url, '/', bypass);
    r.robots = await obtener(url, '/robots.txt', bypass);
    if (env === 'prod') { r.sitemap = await obtener(url, '/sitemap.xml', bypass); for (const e of extra) r.extra404[e] = (await obtener(url, e, bypass)).status; }
    const { errores, avisos } = evaluar(env, r, { strict: a.includes('--strict'), sitemapUrl: val('--sitemap') });
    avisos.forEach((m) => console.log('::warning::' + m));
    errores.forEach((m) => console.log('::error::' + m));
    if (errores.length) { console.log(`✖ Verificación ${env.toUpperCase()} FALLÓ (${errores.length}).`); process.exit(1); }
    console.log(avisos.length ? `⚠ Verificación ${env.toUpperCase()} no concluyente (ver avisos).` : `✔ Verificación ${env.toUpperCase()} correcta (${url}).`);
  })().catch((e) => { console.error('::error::' + e.message); process.exit(1); });
}
