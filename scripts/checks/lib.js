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

/** Centinela "__NINGUNA_APROBADA__" / "__NINGUNO_APROBADO__": activa la validación de una lista sin aprobar nada. */
const CENTINELA = /^__NINGUN[AO]_APROBAD[AO]__$/;
const esCentinela = (v) => CENTINELA.test(String(v).trim());
/**
 * Interpreta una lista de aprobados de release-rules.json.
 * activa = la lista tiene algún elemento (incluido el centinela) → se valida.
 * valores = elementos realmente aprobados (sin centinelas). Lista vacía = validación desactivada.
 */
function listaAprobada(arr) {
  const a = Array.isArray(arr) ? arr : [];
  return { activa: a.length > 0, valores: a.filter((v) => !esCentinela(v)), soloCentinela: a.length > 0 && a.every(esCentinela) };
}
/** Sector exacto: sin acentos ni mayúsculas, pero SIN quitar plural ("clínica" ≠ "clínicas"). */
function normalizarSector(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
const escRe = (m) => String(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Quita del texto los formatos visibles APROBADOS del WhatsApp (whatsapp.formatosVisiblesPermitidos), p. ej.
 * "+52 222 709 7945", para que no se detecten como cifra ("+52"). Solo coincide si no hay dígitos pegados.
 */
function quitarFormatosWhatsapp(texto, formatos) {
  let t = texto;
  for (const f of [...(formatos || [])].sort((a, b) => b.length - a.length)) {
    const re = new RegExp('(?<![\\d+])' + escRe(f).replace(/\\ /g, '\\s') + '(?!\\d)', 'g');
    t = t.replace(re, ' ');
  }
  return t;
}
/** Normaliza para comparar literales: NFC, espacios (incluido nbsp) colapsados. */
const normLiteral = (x) => String(x).normalize('NFC').replace(/[\s\u00a0]+/g, ' ').trim();
/**
 * Regex de un texto LITERAL: coincide exactamente (mayúsculas/minúsculas, acentos y puntuación) salvo los tokens de
 * `ignorarMayusculas` (p. ej. "ÓNIX"), que aceptan cualquier combinación de mayúsculas/minúsculas (ÓNIX, Ónix, ónix).
 * No coincide si hay letras o dígitos pegados antes o después.
 */
function regexLiteral(literal, ignorarMayusculas) {
  let patron = escRe(normLiteral(literal));
  for (const tok of ignorarMayusculas || []) {
    const t = escRe(normLiteral(tok));
    const ci = [...normLiteral(tok)].map((c) => (c.toLowerCase() === c.toUpperCase() ? escRe(c) : `[${c.toUpperCase()}${c.toLowerCase()}]`)).join('');
    patron = patron.split(t).join(ci);
  }
  return new RegExp('(?<![\\p{L}\\p{N}])' + patron + '(?![\\p{L}\\p{N}])', 'u');
}
const contieneLiteral = (texto, literal, ignorarMayusculas) => regexLiteral(literal, ignorarMayusculas).test(normLiteral(texto));

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
/**
 * Árbol de elementos mínimo sobre HTML ya enmascarado (sinComentariosScriptsEstilos).
 * Nodo: { tag, attrs, line, parent, children[], start, innerStart, innerEnd }. Devuelve { raiz, nodos }.
 */
function construirArbol(htmlLimpio) {
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>=`]+))?)*)\s*(\/?)>/g;
  const raiz = { tag: '#raiz', attrs: {}, children: [], parent: null, line: 1, start: 0, innerStart: 0, innerEnd: htmlLimpio.length };
  const nodos = [];
  const pila = [raiz];
  let m;
  while ((m = re.exec(htmlLimpio))) {
    const tag = m[2].toLowerCase();
    if (m[1]) {
      for (let i = pila.length - 1; i > 0; i--) {
        if (pila[i].tag === tag) { pila[i].innerEnd = m.index; pila.length = i; break; }
      }
      continue;
    }
    const nodo = { tag, attrs: atributos(m[3] || ''), line: lineaDe(htmlLimpio, m.index), parent: pila[pila.length - 1], children: [], start: m.index, innerStart: m.index + m[0].length, innerEnd: m.index + m[0].length };
    nodo.parent.children.push(nodo);
    nodos.push(nodo);
    if (!m[4] && !VOID_TAGS.has(tag)) pila.push(nodo);
  }
  return { raiz, nodos };
}
function descendientes(nodo, acc = []) {
  for (const h of nodo.children) { acc.push(h); descendientes(h, acc); }
  return acc;
}

/**
 * EXCEPCIÓN CTA «Contáctanos» (release-rules.json → cta.excepciones, id "contactanos-ancla-interna"; hallazgo H-28).
 * Un enlace NO cuenta como CTA primario solo si cumple TODO esto:
 *   · es un <a> cuyo href empieza por "#" (ancla interna de la misma página, con al menos un carácter de id);
 *   · su texto visible es exactamente «Contáctanos» (mayúscula inicial y acento; sin contar texto solo-lectores);
 *   · el id al que apunta existe en la página y ese elemento es EL botón de WhatsApp aprobado (un <a> con clase de
 *     CTA primario y href = cta.href, con ?text= opcional) o un contenedor que lo contiene (sección, div…); no valen
 *     <html>, <body> ni <main>.
 * Cualquier otro enlace con clase de CTA primario (otro texto, href que no empieza por "#", ancla a un id inexistente
 * o que no contiene el botón de WhatsApp, otro destino) SIGUE contando como CTA. Nota: «/#contacto» (con barra) NO
 * está cubierto: solo «#id».
 */
const TEXTO_CONTACTANOS = 'Contáctanos';
function crearDetectorContactanos(limpio, cfg, clases, permitirTexto) {
  const { nodos } = construirArbol(limpio);
  const esPrimario = (n) => (n.attrs.class || '').split(/\s+/).some((c) => clases.includes(c));
  const botonesWa = nodos.filter((n) => n.tag === 'a' && esPrimario(n) && typeof n.attrs.href === 'string' && !n.attrs.href.startsWith('#') && cfg.href && hrefCtaCoincide(n.attrs.href, cfg.href, permitirTexto));
  const idsDe = (id) => nodos.filter((n) => n.attrs.id === id);
  return function esAncla(t, etiqueta) {
    if (t.tag !== 'a') return { exento: false };
    const href = t.attrs.href;
    if (typeof href !== 'string' || !href.startsWith('#') || href.length < 2) return { exento: false, motivo: 'el href no es una ancla «#id»' };
    if (etiqueta !== TEXTO_CONTACTANOS) return { exento: false, motivo: `el texto es «${etiqueta}», no «${TEXTO_CONTACTANOS}»` };
    let id = href.slice(1);
    try { id = decodeURIComponent(id); } catch (_) { /* se usa tal cual */ }
    const destinos = idsDe(id);
    if (!destinos.length) return { exento: false, motivo: `el id «${id}» no existe en la página` };
    const ok = destinos.some((d) => !['html', 'body', 'main'].includes(d.tag) && (botonesWa.includes(d) || descendientes(d).some((x) => botonesWa.includes(x))));
    if (!ok) return { exento: false, motivo: `el id «${id}» no es (ni contiene) el botón de WhatsApp aprobado` };
    return { exento: true };
  };
}

/** Texto auditable de una página: visible + title + meta descriptions/títulos + alt/aria-label/title. */
function textoAuditable(html) {
  const limpio = sinComentariosScriptsEstilos(html);
  const tags = etiquetas(limpio);
  let texto = textoVisible(html);
  const tit = limpio.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (tit) texto += ' \n ' + aTexto(tit[1]);
  for (const t of tags) {
    if (t.tag === 'meta' && /^(description|og:description|twitter:description|og:title|twitter:title)$/i.test(t.attrs.name || t.attrs.property || '') && t.attrs.content) texto += ' \n ' + decodificar(t.attrs.content);
    for (const a of ['alt', 'aria-label', 'title']) if (t.attrs[a] && t.tag !== 'title') texto += ' \n ' + decodificar(t.attrs[a]);
  }
  return texto;
}
/** Mejor esfuerzo: línea del HTML donde aparece un fragmento de texto auditable (null si no se localiza). */
function lineaDeFragmento(html, fragmento) {
  const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const f = norm(fragmento);
  if (!f) return null;
  const lineas = html.split('\n');
  const plano = lineas.map((l) => norm(decodificar(l.replace(/<[^>]*>/g, ' '))));
  const crudo = lineas.map((l) => norm(decodificar(l)));
  for (const cand of [f, f.slice(0, 25)]) {
    if (cand.length < 3) continue;
    let i = plano.findIndex((l) => l.includes(cand));
    if (i < 0) i = crudo.findIndex((l) => l.includes(cand));
    if (i >= 0) return i + 1;
  }
  return null;
}

/**
 * EXCEPCIONES POR RUTA (release-rules.json → excepcionesPorRuta). NO es una aprobación general: exime a UNA página
 * concreta de ciertas categorías de detección. Guardas en código (cambiarlas requiere revisión de código):
 *   · solo se admiten las rutas de RUTAS_EXCEPTUABLES (hoy únicamente aviso-de-privacidad.html), sin comodines;
 *   · "categorias": solo las de CATEGORIAS_EXCEPTUABLES (cifras, plazos, fechas). Precios, sectores, WhatsApp,
 *     CTA y demás frases siguen aplicando en esa página;
 *   · "terminos": palabras sueltas exentas del check 05 SOLO en esa ruta, y solo las de TERMINOS_EXCEPTUABLES
 *     («tratamiento», «salud»). Se exime únicamente la coincidencia que sea EXACTAMENTE esa palabra: frases más
 *     largas («profesionales de la salud», «expediente clínico», «consultorio», «paciente»…) siguen bloqueadas.
 *   Cada excepción lleva "categorias", "terminos" o ambos.
 */
const RUTAS_EXCEPTUABLES = ['aviso-de-privacidad.html'];
const CATEGORIAS_EXCEPTUABLES = ['cifras', 'plazos', 'fechas'];
const TERMINOS_EXCEPTUABLES = ['tratamiento', 'salud'];
// Reglas de frasesProhibidas que pertenecen a cada categoría (check 05). "fechas": hoy ningún check detecta fechas.
const FRASES_POR_CATEGORIA = { cifras: ['porcentaje', 'multiplicador', 'conteo-clientes'], plazos: ['plazo-numerico', '24-7'], fechas: [] };
function validarExcepcionesPorRuta(reglas) {
  const errs = [];
  const lista = reglas.excepcionesPorRuta;
  if (lista === undefined) return errs;
  if (!Array.isArray(lista)) return ['excepcionesPorRuta debe ser una lista.'];
  lista.forEach((e, i) => {
    const id = (e && e.id) || '#' + i;
    if (!e || typeof e.archivo !== 'string' || /[*?]/.test(e.archivo)) errs.push(`excepcionesPorRuta "${id}": "archivo" debe ser una ruta exacta (sin comodines).`);
    else if (!RUTAS_EXCEPTUABLES.includes(e.archivo)) errs.push(`excepcionesPorRuta "${id}": la ruta "${e.archivo}" no puede exceptuarse (solo: ${RUTAS_EXCEPTUABLES.join(', ')}).`);
    const cats = e && e.categorias;
    const terms = e && e.terminos;
    if (cats === undefined && terms === undefined) errs.push(`excepcionesPorRuta "${id}": necesita "categorias", "terminos" o ambos.`);
    if (cats !== undefined && (!Array.isArray(cats) || !cats.length || cats.some((c) => !CATEGORIAS_EXCEPTUABLES.includes(c)))) errs.push(`excepcionesPorRuta "${id}": "categorias" debe ser una lista no vacía con valores de ${CATEGORIAS_EXCEPTUABLES.join('/')}.`);
    if (terms !== undefined && (!Array.isArray(terms) || !terms.length || terms.some((t) => !TERMINOS_EXCEPTUABLES.includes(t)))) errs.push(`excepcionesPorRuta "${id}": "terminos" debe ser una lista no vacía con valores de ${TERMINOS_EXCEPTUABLES.join('/')}.`);
  });
  return errs;
}
// rutasConSectorPermitido (check 05): solo se admite la ruta /salud (decisión de dirección); cualquier otra es error.
const RUTAS_SECTOR_PERMITIDAS = ['/salud'];
function validarRutasConSectorPermitido(reglas) {
  const errs = [];
  const lista = reglas.rutasConSectorPermitido;
  if (lista === undefined) return errs;
  if (!Array.isArray(lista)) return ['rutasConSectorPermitido debe ser una lista.'];
  lista.forEach((r, i) => {
    if (!r || !RUTAS_SECTOR_PERMITIDAS.includes(r.ruta)) errs.push(`rutasConSectorPermitido[${i}]: la ruta "${r && r.ruta}" no puede exceptuarse (solo: ${RUTAS_SECTOR_PERMITIDAS.join(', ')}).`);
  });
  return errs;
}
/**
 * robots.rutasNoindex (check 04, solo rama con regla "index", p. ej. main): rutas que SÍ pueden ser noindex aunque el
 * sitio sea indexable. Guarda en código: solo /salud (y subrutas «/salud/…»); cualquier otra ruta es error de
 * configuración. Cualquier otra página o header noindex sigue fallando. /salud NO debe ir a main sin revisión de un
 * abogado humano y el OK escrito del dueño del sitio (no hay compuerta automática).
 */
const RUTAS_NOINDEX_PERMITIDAS = ['/salud'];
function validarRutasNoindex(reglas) {
  const rn = reglas.robots && reglas.robots.rutasNoindex;
  if (rn === undefined) return [];
  if (!Array.isArray(rn)) return ['robots.rutasNoindex debe ser una lista.'];
  return rn.filter((r) => !RUTAS_NOINDEX_PERMITIDAS.includes(r)).map((r) => `robots.rutasNoindex: la ruta ${JSON.stringify(r)} no puede ser noindex (solo: ${RUTAS_NOINDEX_PERMITIDAS.join(', ')}).`);
}
/** ¿`url` (p. ej. "/salud/preguntas") es una ruta noindex permitida? Solo si la config es válida. */
function rutaNoindexPermitida(reglas, url) {
  if (validarRutasNoindex(reglas).length) return false;
  const rn = (reglas.robots && reglas.robots.rutasNoindex) || [];
  const u = String(url || '').replace(/\/+$/, '') || '/';
  return rn.some((r) => u === r || u.startsWith(r + '/'));
}
/** ¿El `source` de un header de vercel.json cubre SOLO una ruta noindex permitida (/salud, /salud/(.*), /salud/:path*)? */
function sourceNoindexPermitido(reglas, source) {
  if (validarRutasNoindex(reglas).length) return false;
  const rn = (reglas.robots && reglas.robots.rutasNoindex) || [];
  return rn.some((r) => [r, r + '/(.*)', r + '/:path*', r + '/:path(.*)'].includes(String(source || '').trim()));
}
/** Categorías exentas para una página (Set). Ignora excepciones inválidas. */
function categoriasExentas(reglas, archivoRel) {
  const set = new Set();
  if (validarExcepcionesPorRuta(reglas).length) return set;
  for (const e of reglas.excepcionesPorRuta || []) if (e.archivo === archivoRel) (e.categorias || []).forEach((c) => set.add(c));
  return set;
}
/** Palabras exentas (en minúsculas) del check 05 para una página (Set). Ignora excepciones inválidas. */
function terminosExentosPorRuta(reglas, archivoRel) {
  const set = new Set();
  if (validarExcepcionesPorRuta(reglas).length) return set;
  for (const e of reglas.excepcionesPorRuta || []) if (e.archivo === archivoRel) (e.terminos || []).forEach((t) => set.add(t.toLowerCase()));
  return set;
}
function frasesExentasPorRuta(reglas, archivoRel) {
  const ids = new Set();
  for (const c of categoriasExentas(reglas, archivoRel)) (FRASES_POR_CATEGORIA[c] || []).forEach((id) => ids.add(id));
  return ids;
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
  crearDetectorContactanos, TEXTO_CONTACTANOS, validarRutasNoindex, rutaNoindexPermitida, sourceNoindexPermitido, terminosExentosPorRuta, validarRutasConSectorPermitido, normLiteral, regexLiteral, contieneLiteral, construirArbol, descendientes, validarExcepcionesPorRuta, categoriasExentas, frasesExentasPorRuta, esCentinela, listaAprobada, normalizarSector, quitarFormatosWhatsapp, textoAuditable, lineaDeFragmento, hrefCtaCoincide, ROOT, leerReglas, listarArchivos, listarHtml, rel, leer, urlDePagina,
  enmascarar, sinComentariosScriptsEstilos, etiquetas, atributos, lineaDe, decodificar, aTexto,
  textoVisible, contenidoElemento, textoSinSrOnly, normalizar, normalizarPalabra, ramaObjetivo, Reporte,
};
