#!/usr/bin/env node
'use strict';
/**
 * Check 3 · Enlaces internos, anclas (#id) y referencias a assets rotas.
 * Revisa HTML (a, link, script, img, source, video, audio, iframe, form, srcset, poster) y CSS (url()).
 * Respeta cleanUrls de Vercel (/servicios -> servicios.html). No hace peticiones de red.
 * Enlaces a onix-ia.com se tratan como internos (se verifica que la ruta exista en el repo).
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const R = new L.Reporte('Enlaces internos, anclas y assets');

const HOSTS_PROPIOS = new Set(['onix-ia.com', 'www.onix-ia.com']);
const archivosHtml = L.listarHtml();
const idsPorUrl = new Map(); // '/servicios' -> Set(ids)
const urlsValidas = new Map(); // ruta pública -> archivo

for (const f of archivosHtml) {
  const html = L.sinComentariosScriptsEstilos(L.leer(f));
  const ids = new Set();
  for (const t of L.etiquetas(html)) {
    if (t.attrs.id) ids.add(t.attrs.id);
    if (t.tag === 'a' && t.attrs.name) ids.add(t.attrs.name);
  }
  const u = L.urlDePagina(f);
  idsPorUrl.set(u, ids);
  urlsValidas.set(u, f);
}

function existeArchivo(p) {
  const abs = path.join(L.ROOT, p);
  return abs.startsWith(L.ROOT) && fs.existsSync(abs) && fs.statSync(abs).isFile();
}
/** Resuelve una ruta pública a {tipo:'pagina'|'asset', clave} o null si no existe. */
function resolver(rutaPublica) {
  let p = decodeURIComponent(rutaPublica);
  if (urlsValidas.has(p)) return { tipo: 'pagina', clave: p };
  if (p.length > 1 && p.endsWith('/') && urlsValidas.has(p.slice(0, -1))) return { tipo: 'pagina', clave: p.slice(0, -1), barraFinal: true };
  if (p.endsWith('/index.html')) { const c = p.slice(0, -10) || '/'; if (urlsValidas.has(c)) return { tipo: 'pagina', clave: c, conExt: true }; }
  if (p.endsWith('.html') && urlsValidas.has(p.slice(0, -5))) return { tipo: 'pagina', clave: p.slice(0, -5), conExt: true };
  if (existeArchivo(p.replace(/^\//, ''))) return { tipo: 'asset', clave: p };
  return null;
}

function revisarReferencia(archivo, linea, valor, paginaUrl, contexto) {
  if (!valor) return;
  let v = valor.trim();
  if (!v || /^(mailto:|tel:|sms:|javascript:|data:|blob:|about:)/i.test(v)) return;
  if (/^\{\{|^\$\{|^<%/.test(v)) return;
  let url;
  try { url = new URL(v, 'https://onix-ia.com' + paginaUrl); } catch (_) { R.error(archivo, linea, `URL inválida (${contexto}): "${v}"`); return; }
  const externo = /^[a-z][a-z0-9+.-]*:|^\/\//i.test(v) && !HOSTS_PROPIOS.has(url.hostname);
  if (externo) return; // externos: no se validan offline
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  const ruta = url.pathname;
  const r = resolver(ruta);
  if (!r) {
    R.error(archivo, linea, `Enlace/asset roto (${contexto}): "${v}" → no existe ${ruta} en el repo.`);
    return;
  }
  if (r.conExt) R.aviso(archivo, linea, `Enlace con ".html" explícito ("${v}"); con cleanUrls la URL pública es "${r.clave}".`);
  if (r.barraFinal) R.aviso(archivo, linea, `Enlace con "/" final ("${v}"); vercel.json tiene trailingSlash=false, redirigirá a "${r.clave}".`);
  if (url.hash && url.hash.length > 1 && r.tipo === 'pagina') {
    const id = decodeURIComponent(url.hash.slice(1));
    if (id !== 'top' && !(idsPorUrl.get(r.clave) || new Set()).has(id)) {
      R.error(archivo, linea, `Ancla rota (${contexto}): "${v}" → no existe id="${id}" en ${r.clave}.`);
    }
  }
}

const ATTRS = { a: ['href'], area: ['href'], link: ['href'], script: ['src'], img: ['src', 'srcset'], source: ['src', 'srcset'], video: ['src', 'poster'], audio: ['src'], iframe: ['src'], form: ['action'], embed: ['src'], track: ['src'], input: ['src'] };

for (const f of archivosHtml) {
  const nombre = L.rel(f);
  const pagina = L.urlDePagina(f);
  const html = L.leer(f);
  const limpio = L.sinComentariosScriptsEstilos(html);
  let n = 0;
  for (const t of L.etiquetas(limpio)) {
    for (const a of ATTRS[t.tag] || []) {
      const val = t.attrs[a];
      if (val === undefined) continue;
      if (t.tag === 'link' && a === 'href' && /^(canonical|alternate|me|author|license)$/i.test(t.attrs.rel || '') && /^https?:/i.test(val) && !HOSTS_PROPIOS.has(new URL(val, 'https://x').hostname)) continue;
      if (a === 'srcset') for (const parte of val.split(',')) revisarReferencia(nombre, t.line, parte.trim().split(/\s+/)[0], pagina, `${t.tag}[srcset]`);
      else { revisarReferencia(nombre, t.line, val, pagina, `${t.tag}[${a}]`); n++; }
    }
    if (t.attrs.style) for (const m of t.attrs.style.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) revisarReferencia(nombre, t.line, m[1], pagina, 'style url()');
  }
  // CSS inline en <style>
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) for (const u of m[1].matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) revisarReferencia(nombre, null, u[1], pagina, '<style> url()');
  // Enlaces repetidos en nav se cuentan una vez
  void n;
}

// CSS externos: url() relativo al propio css
for (const f of L.listarArchivos(['.css'])) {
  const css = L.leer(f).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const base = '/' + L.rel(f);
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    revisarReferencia(L.rel(f), L.lineaDe(css, m.index), m[1], base, 'css url()');
  }
}

// vercel.json: sanity
try { JSON.parse(L.leer(path.join(L.ROOT, 'vercel.json'))); } catch (e) { R.error('vercel.json', null, 'vercel.json no es JSON válido: ' + e.message); }

R.nota(`${archivosHtml.length} páginas HTML revisadas: ${[...urlsValidas.keys()].join(', ')}`);
R.terminar();
