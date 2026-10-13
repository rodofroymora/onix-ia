#!/usr/bin/env node
'use strict';
/**
 * Verificación POSTERIOR al deploy (solo lectura: peticiones GET) sobre UN mismo deployment/URL.
 *   node verify-deploy.js --env dev  --url https://<deploy-dev>        [--strict] [--tolerar-proteccion]
 *   node verify-deploy.js --env prod --url https://www.onix-ia.com     [--strict] [--sitemap <URL exacta>] [--tolerar-proteccion] [--404 /salud ...]
 * Variable opcional BYPASS_SECRET: se envía como cabecera x-vercel-protection-bypass (deployments protegidos de Vercel).
 *
 * Rutas que DEBEN responder 200 (forma cleanUrls, sin .html): /, /aviso-de-privacidad, /robots.txt, /sitemap.xml. Se imprime «código ruta» de cada una.
 *  dev  → la home y /aviso-de-privacidad traen header X-Robots-Tag con noindex (la home además la meta robots noindex); /robots.txt con «Disallow: /»;
 *         /sitemap.xml con <urlset>. Si /aviso-de-privacidad aún contiene «FECHA DE VIGENCIA»/«borrador» solo AVISA (dev lo tiene hasta que corre golive.js).
 *  prod → sin X-Robots-Tag noindex ni meta noindex (home y aviso); /robots.txt sin «Disallow: /» y con «Sitemap:» (exacta si se da --sitemap);
 *         /sitemap.xml con <urlset>; /aviso-de-privacidad SIN «FECHA DE VIGENCIA» ni «borrador» (cualquier mayúscula); cada ruta de --404 debe responder 404.
 * Si el deployment está protegido (401/403) y no hay BYPASS_SECRET: en dev (o con --tolerar-proteccion) se avisa (::warning::) y NO falla, salvo --strict;
 * en prod sin --tolerar-proteccion siempre falla. --ignorar-header-vercel (solo URLs *.vercel.app): no cuenta el X-Robots-Tag que pone Vercel. Si la respuesta es la PÁGINA DE LOGIN de Vercel (200 tras redirigir a vercel.com/sso-api),
 * SIEMPRE falla (dev y prod, con o sin --tolerar-proteccion): se estaría verificando el login, no el sitio. Código de salida: 0 ok, 1 incumple, 2 uso incorrecto.
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

const MARCADOR_RE = /fecha(?:\s|&nbsp;|&#160;)+de(?:\s|&nbsp;|&#160;)+vigencia|borrador/i;

/** r = { home, aviso, robots, sitemap: {status,headers?,body}, extra404:{ruta:status} }. Devuelve { errores, avisos }. */
// Página de login de Vercel (Deployment Protection): llega con 200 tras seguir la redirección a vercel.com/sso-api.
// Si no se detecta, se «verifica» la pantalla de login en vez del sitio (falso resultado).
const LOGIN_RE = /Vercel Authentication|vercel\.com\/sso-api|_vercel_sso_nonce|Authenticating\.\.\./i;
const esLoginVercel = (x) => !!x && (x.login === true || /^https:\/\/([a-z0-9-]+\.)*vercel\.com\//i.test(x.finalUrl || '') || LOGIN_RE.test(String(x.body || '').slice(0, 20000)));
function evaluar(env, r, opciones = {}) {
  const errores = [], avisos = [];
  const conLogin = ['home', 'aviso', 'robots', 'sitemap'].filter((k) => esLoginVercel(r[k]));
  if (conLogin.length) {
    errores.push(`${env.toUpperCase()}: la respuesta es la página de login de Vercel (${conLogin.join(', ')}), no el sitio: falta o es incorrecto BYPASS_SECRET (debe ser el del MISMO proyecto Vercel).`);
    return { errores, avisos };
  }
  const protegido = r.home && [401, 403].includes(r.home.status);
  if (protegido) {
    const msg = `la home respondió ${r.home.status} (deployment protegido): no se puede verificar la política de indexación sin BYPASS_SECRET.`;
    if ((env === 'dev' || opciones.tolerarProteccion) && !opciones.strict) avisos.push(msg); else errores.push(msg);
    return { errores, avisos };
  }
  const E = env.toUpperCase();
  const ok200 = (x, ruta) => { if (!x || x.status !== 200) { errores.push(`${E}: ${ruta} debe responder 200 (estado ${x && x.status}).`); return false; } return true; };
  if (!ok200(r.home, '/')) return { errores, avisos };
  const hdr = noindexEnHeader(r.home.headers), meta = noindexEnMeta(r.home.body);
  const aviso200 = ok200(r.aviso, '/aviso-de-privacidad');
  const robots200 = ok200(r.robots, '/robots.txt');
  const ri = robots200 ? robotsInfo(r.robots.body) : null;
  const sm200 = ok200(r.sitemap, '/sitemap.xml');
  if (sm200 && !/<(urlset|sitemapindex)\b/i.test(r.sitemap.body || '')) errores.push(`${E}: /sitemap.xml no es válido (falta <urlset>).`);
  if (env === 'dev') {
    if (!hdr) errores.push('DEV: falta el header X-Robots-Tag noindex en la home.');
    if (!meta) errores.push('DEV: falta <meta name="robots" content="noindex…"> en la home.');
    if (aviso200 && !noindexEnHeader(r.aviso.headers)) errores.push('DEV: falta el header X-Robots-Tag noindex en /aviso-de-privacidad.');
    if (ri && !ri.disallowTodo) errores.push('DEV: /robots.txt debe tener «Disallow: /».');
    if (aviso200 && MARCADOR_RE.test(r.aviso.body || '')) avisos.push('DEV: /aviso-de-privacidad aún contiene «FECHA DE VIGENCIA»/«borrador» (normal en dev hasta que corre golive.js; en main está bloqueado).');
  } else {
    // Vercel añade «X-Robots-Tag: noindex» a TODA URL *.vercel.app de un deployment (también los de producción); el dominio propio no lo lleva.
    // Con --ignorar-header-vercel (solo en URLs *.vercel.app) ese header se reporta como aviso; meta, robots.txt y sitemap se siguen exigiendo.
    const ignHdr = !!opciones.ignorarHeaderVercel;
    if (ignHdr && (hdr || (r.aviso && noindexEnHeader(r.aviso.headers)))) avisos.push('PROD: X-Robots-Tag noindex en la URL *.vercel.app (lo pone la plataforma; se verifica en el dominio tras promover).');
    if (hdr && !ignHdr) errores.push('PROD: la home trae X-Robots-Tag noindex.');
    if (meta) errores.push('PROD: la home tiene <meta name="robots" content="noindex…">.');
    if (aviso200) {
      if ((noindexEnHeader(r.aviso.headers) && !ignHdr) || noindexEnMeta(r.aviso.body)) errores.push('PROD: /aviso-de-privacidad tiene noindex.');
      const m = String(r.aviso.body || '').match(MARCADOR_RE);
      if (m) errores.push(`PROD: /aviso-de-privacidad contiene el marcador pendiente «${m[0]}».`);
    }
    if (ri) {
      if (ri.disallowTodo) errores.push('PROD: /robots.txt tiene «Disallow: /».');
      if (!ri.sitemap) errores.push('PROD: /robots.txt no referencia el sitemap.');
      else if (opciones.sitemapUrl && !ri.urls.includes(opciones.sitemapUrl)) errores.push(`PROD: /robots.txt debe referenciar ${opciones.sitemapUrl} (tiene ${ri.urls.join(', ')}).`);
    }
    for (const [ruta, st] of Object.entries(r.extra404 || {})) if (st !== 404) errores.push(`PROD: ${ruta} debería responder 404 (estado ${st}).`);
  }
  return { errores, avisos };
}

async function obtener(base, ruta, bypass) {
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
  const res = await fetch(new URL(ruta, base), { redirect: 'follow', headers });
  const h = {}; res.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
  const body = await res.text();
  const x = { status: res.status, headers: h, body, finalUrl: res.url };
  x.login = esLoginVercel(x);
  return x;
}

module.exports = { evaluar, esLoginVercel, robotsInfo, noindexEnMeta, noindexEnHeader };

if (require.main === module) {
  const a = process.argv.slice(2);
  const val = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const env = val('--env'), url = val('--url');
  if (!['dev', 'prod'].includes(env) || !url) { console.error('Uso: node verify-deploy.js --env dev|prod --url <url> [--strict] [--404 /ruta]...'); process.exit(2); }
  const extra = a.reduce((acc, x, i) => (x === '--404' ? acc.concat(a[i + 1]) : acc), []);
  const bypass = process.env.BYPASS_SECRET || '';
  (async () => {
    const r = { extra404: {} };
    for (const [k, ruta] of [['home', '/'], ['aviso', '/aviso-de-privacidad'], ['robots', '/robots.txt'], ['sitemap', '/sitemap.xml']]) {
      r[k] = await obtener(url, ruta, bypass); console.log(`  ${r[k].status} ${ruta}`);
      if (r[k].login) console.log(`  ⚠ ${ruta}: página de login de Vercel (${r[k].finalUrl})`);
      if (k === 'home' && ([401, 403].includes(r.home.status) || r.home.login)) break;
    }
    if (env === 'prod') for (const e of extra) { r.extra404[e] = (await obtener(url, e, bypass)).status; console.log(`  ${r.extra404[e]} ${e} (se espera 404)`); }
    const { errores, avisos } = evaluar(env, r, { strict: a.includes('--strict'), sitemapUrl: val('--sitemap'), tolerarProteccion: a.includes('--tolerar-proteccion'), ignorarHeaderVercel: a.includes('--ignorar-header-vercel') && /\.vercel\.app$/i.test(new URL(url).hostname) });
    avisos.forEach((m) => console.log('::warning::' + m));
    errores.forEach((m) => console.log('::error::' + m));
    if (errores.length) { console.log(`✖ Verificación ${env.toUpperCase()} FALLÓ (${errores.length}).`); process.exit(1); }
    const soloPlataforma = avisos.length && avisos.every((m) => m.includes('lo pone la plataforma'));
    console.log(avisos.length && !soloPlataforma ? `⚠ Verificación ${env.toUpperCase()} no concluyente (ver avisos).` : `✔ Verificación ${env.toUpperCase()} correcta (${url}).`);
  })().catch((e) => { console.error('::error::' + e.message); process.exit(1); });
}
