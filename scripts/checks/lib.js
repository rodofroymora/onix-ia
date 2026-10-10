'use strict';
/**
 * Utilidades compartidas de los checks de release de ONIX.
 * Node 20, SIN dependencias npm. Parser HTML basado en regex (suficiente para sitio estático propio).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const IGNORAR_DIRS = new Set(['.git', '.github', '.vercel', 'node_modules', 'scripts', 'docs', 'fonts']);

function leerReglas() {
  const f = path.join(ROOT, 'release-rules.json');
  if (!fs.existsSync(f)) {
    console.error('✖ No existe release-rules.json en la raíz del repo. Es obligatorio para los checks.');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.error('✖ release-rules.json no es JSON válido: ' + e.message);
    process.exit(1);
  }
}

function listarArchivos(ext, dir = ROOT, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (IGNORAR_DIRS.has(ent.name) && dir === ROOT) continue;
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      listarArchivos(ext, path.join(dir, ent.name), acc);
    } else if (ext.some((e) => ent.name.toLowerCase().endsWith(e))) {
      acc.push(path.join(dir, ent.name));
    }
  }
  return acc.sort();
}
const listarHtml = () => listarArchivos(['.html']);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const leer = (f) => fs.readFileSync(f, 'utf8');

/** URL pública (cleanUrls) de un archivo html: index.html -> /, servicios.html -> /servicios */
function urlDePagina(file) {
  let r = rel(file).replace(/\.html$/i, '');
  if (r === 'index') return '/';
  if (r.endsWith('/index')) return '/' + r.slice(0, -6);
  return '/' + r;
}

/** Reemplaza trozos por espacios conservando saltos de línea (para mantener números de línea). */
function enmascarar(html, re) {
  return html.replace(re, (m) => m.replace(/[^\n]/g, ' '));
}
function sinComentariosScriptsEstilos(html) {
  let h = enmascarar(html, /<!--[\s\S]*?-->/g);
  h = enmascarar(h, /<script\b[\s\S]*?<\/script\s*>/gi);
  h = enmascarar(h, /<style\b[\s\S]*?<\/style\s*>/gi);
  return h;
}

const TAG_RE = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>=`]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+)))?/g;

function atributos(attrStr) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(attrStr))) {
    out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
  }
  return out;
}
function lineaDe(texto, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < texto.length; i++) if (texto.charCodeAt(i) === 10) n++;
  return n;
}
/** Todas las etiquetas de apertura: [{tag, attrs, index, line, raw, end}] (sobre html ya enmascarado). */
function etiquetas(htmlLimpio) {
  const res = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(htmlLimpio))) {
    res.push({
      tag: m[1].toLowerCase(),
      attrs: atributos(m[2] || ''),
      index: m.index,
      end: m.index + m[0].length,
      line: lineaDe(htmlLimpio, m.index),
      raw: m[0],
    });
  }
  return res;
}
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&middot;': '·', '&hellip;': '…', '&copy;': '©' };
function decodificar(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENT[e.toLowerCase()] || e);
}
function aTexto(fragmento) {
  let t = fragmento.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, ' ');
  t = t.replace(/<[^>]*>/g, ' ');
  return decodificar(t).replace(/\s+/g, ' ').trim();
}
/** Texto visible (body) sin scripts/estilos/comentarios. */
function textoVisible(html) {
  const limpio = sinComentariosScriptsEstilos(html);
  const m = limpio.match(/<body\b[\s\S]*<\/body\s*>/i);
  let cuerpo = m ? m[0] : limpio;
  // quita contenido de elementos sr-only? No: lectores de pantalla lo leen; se conserva.
  cuerpo = cuerpo.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, ' ');
  // atributos tipo <a title=".."> no son texto visible; solo nodos de texto
  let out = '';
  let last = 0;
  let mm;
  TAG_RE.lastIndex = 0;
  while ((mm = TAG_RE.exec(cuerpo))) {
    out += cuerpo.slice(last, mm.index) + ' ';
    last = mm.index + mm[0].length;
  }
  out += cuerpo.slice(last);
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
  return decodificar(out).replace(/\s+/g, ' ').trim();
}
/** Contenido de <tag ...>...</tag> para la etiqueta que empieza en `t` (no anidada). */
function contenidoElemento(htmlLimpio, t) {
  const cierre = new RegExp('</' + t.tag + '\\s*>', 'i');
  const resto = htmlLimpio.slice(t.end);
  const m = cierre.exec(resto);
  return m ? resto.slice(0, m.index) : '';
}
function textoSinSrOnly(fragmento) {
  const f = fragmento.replace(/<span\b[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>[\s\S]*?<\/span\s*>/gi, ' ');
  return aTexto(f);
}

function normalizar(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s,]+/g, '').replace(/\u00a0/g, '');
}
function normalizarPalabra(s) {
  let w = String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return w.replace(/(es|s)$/, '');
}

/** Rama objetivo para la regla de robots. */
function ramaObjetivo() {
  const env = process.env;
  if (env.CHECK_BRANCH) return { rama: env.CHECK_BRANCH, origen: 'CHECK_BRANCH' };
  if (env.GITHUB_BASE_REF) return { rama: env.GITHUB_BASE_REF, origen: 'GITHUB_BASE_REF (rama destino del PR)' };
  if (env.GITHUB_REF_NAME) return { rama: env.GITHUB_REF_NAME, origen: 'GITHUB_REF_NAME' };
  try {
    const b = execSync('git symbolic-ref --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { rama: b, origen: 'rama git actual' };
  } catch (_) {
    return { rama: null, origen: 'desconocida' };
  }
}

class Reporte {
  constructor(nombre) {
    this.nombre = nombre;
    this.errores = [];
    this.avisos = [];
    this.info = [];
  }
  error(archivo, linea, msg) { this.errores.push({ archivo, linea, msg }); }
  aviso(archivo, linea, msg) { this.avisos.push({ archivo, linea, msg }); }
  nota(msg) { this.info.push(msg); }
  _fmt(x) { return (x.archivo ? x.archivo + (x.linea ? ':' + x.linea : '') + ' — ' : '') + x.msg; }
  terminar() {
    const gh = process.env.GITHUB_ACTIONS === 'true';
    console.log('\n━━ ' + this.nombre + ' ━━');
    this.info.forEach((i) => console.log('ℹ ' + i));
    this.avisos.forEach((a) => {
      console.log('⚠ AVISO: ' + this._fmt(a));
      if (gh) console.log(`::warning ${a.archivo ? 'file=' + a.archivo + (a.linea ? ',line=' + a.linea : '') : ''}::${a.msg}`);
    });
    this.errores.forEach((e) => {
      console.log('✖ ERROR: ' + this._fmt(e));
      if (gh) console.log(`::error ${e.archivo ? 'file=' + e.archivo + (e.linea ? ',line=' + e.linea : '') : ''}::${e.msg}`);
    });
    if (this.errores.length) {
      console.log(`\n✖ FALLÓ "${this.nombre}": ${this.errores.length} error(es), ${this.avisos.length} aviso(s).`);
      process.exit(1);
    }
    console.log(`\n✔ OK "${this.nombre}" (${this.avisos.length} aviso(s)).`);
    process.exit(0);
  }
}

/**
 * ¿El href de un CTA coincide con el href aprobado?
 * Coincidencia exacta, o (si la excepción "whatsapp-mensaje-precargado" está activa) mismo origen + ruta
 * con, como ÚNICO parámetro de consulta permitido, `text` (mensaje precargado). Se compara origen+ruta;
 * otro número, otra ruta, otro parámetro (p. ej. ?foo=1, &lang=es) o un fragmento (#...) NO coinciden.
 */
function hrefCtaCoincide(href, aprobado, permitirTexto) {
  if (href === aprobado) return true;
  if (!permitirTexto || typeof href !== 'string' || typeof aprobado !== 'string') return false;
  let u, a;
  try { u = new URL(href); a = new URL(aprobado); } catch (e) { return false; }
  if (a.search || a.hash) return false;
  if (u.origin !== a.origin || u.pathname !== a.pathname) return false;
  if (u.hash || u.username || u.password) return false;
  for (const k of u.searchParams.keys()) if (k !== 'text') return false;
  if (u.searchParams.getAll('text').length > 1) return false;
  return true;
}

module.exports = {
  hrefCtaCoincide, ROOT, leerReglas, listarArchivos, listarHtml, rel, leer, urlDePagina,
  enmascarar, sinComentariosScriptsEstilos, etiquetas, atributos, lineaDe, decodificar, aTexto,
  textoVisible, contenidoElemento, textoSinSrOnly, normalizar, normalizarPalabra, ramaObjetivo, Reporte,
};
