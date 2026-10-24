#!/usr/bin/env node
'use strict';
/**
 * Check 5 · Frases prohibidas (release-rules.json → frasesProhibidas, excepcionesAprobadas, rutasConSectorPermitido).
 * Base: propuesta v3 del Arquitecto de soluciones (límites de palabra Unicode en el JSON, sin \b ni \w; excepción por
 * ruta para sectores; negaciones como advertencia), con las siguientes adiciones del repo:
 *   · permiteNegacion (opt-in por regla), ver abajo;
 *   · excepción POR RUTA del aviso de privacidad (excepcionesPorRuta, ver lib.js);
 *   · validación estricta de la configuración y número de línea en los errores.
 *
 * Niveles: "bloqueante" → error (falla el PR) · "advertencia" → aviso (revisión humana; no falla).
 * Texto auditado: el mismo que 01-cifras-consistencia.js (visible + <title> + metas + alt/aria-label/title).
 * Antes de aplicar los patrones se ENMASCARAN las excepciones aprobadas (WhatsApp oficial y correo info@onix-ia.com).
 *
 * negacion: "advertencia" (campo del Arquitecto): si en la misma oración, antes del término, aparece no/sin/ni/nunca,
 *   el hallazgo baja de bloqueante a advertencia (p. ej. «No es un doctor virtual»).
 *
 * permiteNegacion: true (opt-in por regla; decisión de dirección): una coincidencia NO se marca (ni error ni aviso) si:
 *   · está NEGADA: en la cláusula que la precede hay una palabra de negacionPermitida.palabras (no/nunca/jamás/
 *     tampoco/ni) dentro de las últimas `ventanaPalabras` palabras antes de la coincidencia («no estamos certificados»,
 *     «No calcula impuestos…»), salvo que le siga solo/sólo/solamente/únicamente. La cláusula empieza tras , ; : . ! ? ¿
 *     o tras pero/sino/aunque/excepto/salvo/mientras («no estamos certificados, pero estamos certificados…» sigue bloqueada);
 *   · o está dentro de una PREGUNTA «¿ … ?» (típica de FAQ).
 *   Las afirmaciones siguen bloqueadas. Reglas sin el flag no se afectan.
 *
 * rutasConSectorPermitido (v3): cada término es bloqueante salvo en la ruta indicada (o subrutas «/ruta/…»).
 * excepcionesPorRuta: en el archivo indicado se omiten las frases de las categorías exentas y las coincidencias que
 * sean EXACTAMENTE una palabra de "terminos" (hoy «tratamiento» y «salud» en aviso-de-privacidad.html; ver lib.js).
 * Node 20, sin dependencias.
 */
const L = require('./lib');

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const conG = (flags) => (String(flags || 'u').includes('g') ? String(flags || 'u') : String(flags || 'u') + 'g');
const NIVELES = ['bloqueante', 'advertencia'];

/** Compila reglas y excepciones desde release-rules.json. Devuelve { patrones, mascaras, negacion, errores }. */
function compilar(reglas) {
  const patrones = [];
  const errores = [];
  const ids = new Set();
  (Array.isArray(reglas.frasesProhibidas) ? reglas.frasesProhibidas : []).forEach((f, i) => {
    const id = f && f.id ? String(f.id) : `#${i}`;
    if (!f || !f.id) { errores.push(`frasesProhibidas[${i}]: falta "id".`); return; }
    if (ids.has(f.id)) { errores.push(`frasesProhibidas "${id}": id duplicado.`); return; }
    ids.add(f.id);
    if (!NIVELES.includes(f.nivel)) { errores.push(`frasesProhibidas "${id}": nivel "${f.nivel}" inválido (usa "bloqueante" o "advertencia").`); return; }
    if (!f.regex) { errores.push(`frasesProhibidas "${id}": falta "regex".`); return; }
    if (f.permiteNegacion !== undefined && typeof f.permiteNegacion !== 'boolean') { errores.push(`frasesProhibidas "${id}": "permiteNegacion" debe ser true o false.`); return; }
    if (f.negacion !== undefined && f.negacion !== 'advertencia') { errores.push(`frasesProhibidas "${id}": "negacion" solo admite "advertencia".`); return; }
    let re;
    try { re = new RegExp(f.regex, conG(f.flags)); } catch (e) { errores.push(`frasesProhibidas "${id}": regex inválida (${e.message}).`); return; }
    patrones.push({ id: f.id, nivel: f.nivel, negacion: f.negacion || null, permiteNegacion: f.permiteNegacion === true, re, fuente: f.fuente || '', ejemplo: f.ejemplo || '', exceptoRutas: [] });
  });
  // v3 · términos de sector permitidos SOLO en ciertas rutas: fuera de ellas son bloqueantes.
  (Array.isArray(reglas.rutasConSectorPermitido) ? reglas.rutasConSectorPermitido : []).forEach((r) => {
    if (!r || !r.ruta || !Array.isArray(r.terminos)) { errores.push('rutasConSectorPermitido: cada entrada necesita "ruta" y "terminos".'); return; }
    for (const t of r.terminos) {
      const re = new RegExp('(?<![\\p{L}\\p{N}_])' + esc(t).replace(/\s+/g, '\\s+') + '(?![\\p{L}\\p{N}_])', 'giu');
      patrones.push({ id: 'sector-fuera-de-ruta', nivel: 'bloqueante', negacion: null, permiteNegacion: false, re, fuente: `“${t}” solo se permite en ${r.ruta} (rutasConSectorPermitido)`, ejemplo: t, exceptoRutas: [r.ruta] });
    }
  });
  const mascaras = [];
  const ex = reglas.excepcionesAprobadas || {};
  for (const [k, v] of Object.entries(ex)) {
    if (k.startsWith('_') || !v || typeof v !== 'object') continue;
    if (v.regex) mascaras.push({ id: k, re: new RegExp(v.regex, conG(v.flags)) });
    for (const val of [...(v.valores || []), ...(v.variantes || [])]) mascaras.push({ id: k, re: new RegExp(esc(val), 'giu') });
  }
  for (const t of reglas.textosExactosAprobados || []) {
    if (!t || !t.texto) continue;
    mascaras.push({ id: t.id || 'textoExacto', re: regexTextoExacto(t.texto) });
  }
  return { patrones, mascaras, negacion: reglas.negacionPermitida || null, errores };
}

// textosExactosAprobados (spec v8.1): coincidencia EXACTA (mayúsculas, acentos y puntuación; solo los espacios pueden
// colapsar), con límites de palabra. Marcadores acotados: [negocio] = 1 a 4 palabras con mayúscula inicial;
// [medio] = 1 a 8 palabras sin puntuación de oración. Nada de texto arbitrario.
const PALABRA_NEGOCIO = "\\p{Lu}[\\p{L}\\p{N}'’&-]*";
const PALABRA_MEDIO = '[\\p{L}\\p{N}][\\p{L}\\p{N}/-]*';
const MARCADORES_TEXTO = {
  '[negocio]': `${PALABRA_NEGOCIO}(?: ${PALABRA_NEGOCIO}){0,3}`,
  '[medio]': `${PALABRA_MEDIO}(?: ${PALABRA_MEDIO}){0,7}`,
};
function regexTextoExacto(texto) {
  const partes = texto.trim().split(/(\[negocio\]|\[medio\])/);
  const src = partes.map((p) => MARCADORES_TEXTO[p] || esc(p).replace(/\s+/g, '\\s+')).join('');
  return new RegExp('(?<![\\p{L}\\p{N}_])' + src + '(?![\\p{L}\\p{N}_])', 'gu');
}

/**
 * Spec v9 (preguntasUsuarioPermitidas): borra del HTML el texto de una pregunta permitida SOLO cuando es el contenido
 * completo de un elemento con la clase indicada (burbuja del usuario) en una de las páginas indicadas.
 */
function omitirPreguntasUsuario(html, nombre, reglas) {
  const cfg = reglas && reglas.preguntasUsuarioPermitidas;
  if (!cfg || !Array.isArray(cfg.textos) || !cfg.clase) return html;
  if (Array.isArray(cfg.paginas) && !cfg.paginas.includes(nombre)) return html;
  const clase = esc(cfg.clase);
  let h = html;
  for (const t of cfg.textos) {
    const re = new RegExp(`(<([a-z][a-z0-9]*)\\b[^>]*\\bclass\\s*=\\s*["'][^"']*(?<![\\w-])${clase}(?![\\w-])[^"']*["'][^>]*>)\\s*${esc(t)}\\s*(</\\2\\s*>)`, 'gu');
    h = h.replace(re, (m, a, tag, c) => a + ' '.repeat(m.length - a.length - c.length) + c);
  }
  return h;
}

/** Reemplaza cada excepción por espacios (misma longitud) para no mover posiciones. */
function enmascararExcepciones(texto, mascaras) {
  let t = texto;
  for (const { re } of mascaras) { re.lastIndex = 0; t = t.replace(re, (m) => ' '.repeat(m.length)); }
  return t;
}

const NEGACION = /(?:^|[^\p{L}\p{N}_])(?:no|sin|ni|nunca)(?![\p{L}\p{N}_])/iu;
/** ¿La ruta de la página es `ruta` o una subruta? */
function enRuta(urlPagina, ruta) {
  if (!urlPagina) return false;
  const u = urlPagina.replace(/\/+$/, '') || '/';
  const r = ruta.replace(/\/+$/, '') || '/';
  return u === r || u.startsWith(r + '/');
}
/** (campo "negacion") ¿Hay una negación en la misma oración, antes de la coincidencia? */
function negado(texto, idx) {
  const antes = texto.slice(Math.max(0, idx - 80), idx);
  const oracion = antes.split(/[.!?¿¡;:\n]/).pop();
  return NEGACION.test(oracion);
}

// ── permiteNegacion ─────────────────────────────────────────────────────────
// El punto solo termina oración si va seguido de espacio o fin (no en «e.firma» ni «3.5»); el salto de línea también.
const TERMINADORES = /\.(?=\s|$)|[!?;\n]/g;
const SEPARADORES_CLAUSULA = /[,;:!?¿\n]|\.(?=\s|$)|(?<![\p{L}\p{N}])(?:pero|sino|aunque|excepto|salvo|mientras)(?![\p{L}\p{N}])/giu;
function ultimoIndice(texto, re, hasta) {
  re.lastIndex = 0;
  let ult = -1, fin = 0, m;
  while ((m = re.exec(texto)) && m.index < hasta) { ult = m.index; fin = m.index + m[0].length; if (m[0] === '') re.lastIndex++; }
  return { ind: ult, fin };
}
function clausulaPrevia(texto, idx) {
  const { fin } = ultimoIndice(texto, SEPARADORES_CLAUSULA, idx);
  return texto.slice(fin, idx);
}
/** Pregunta «¿ … ?» que contiene la coincidencia, o null. */
function preguntaQueContiene(texto, idx, len) {
  const ant = ultimoIndice(texto, TERMINADORES, idx).ind;
  const inv = texto.lastIndexOf('¿', idx);
  if (inv < 0 || inv <= ant) return null;
  TERMINADORES.lastIndex = idx + len;
  const sig = TERMINADORES.exec(texto);
  if (!sig || sig[0] !== '?') return null;
  return texto.slice(inv, sig.index + 1);
}
const NEGACION_POR_DEFECTO = { palabras: ['no', 'nunca', 'jamás', 'tampoco', 'ni'], noSi: ['solo', 'sólo', 'solamente', 'únicamente'], ventanaPalabras: 6, permitePregunta: true };
const limpiarPalabra = (w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
/** ¿Hay una negación en la cláusula, dentro de las últimas N palabras antes de la coincidencia? */
function estaNegada(texto, idx, cfg) {
  const c = Object.assign({}, NEGACION_POR_DEFECTO, cfg || {});
  const palabras = clausulaPrevia(texto, idx).split(/\s+/).map(limpiarPalabra).filter(Boolean);
  const ult = c.ventanaPalabras > 0 ? palabras.slice(-c.ventanaPalabras) : [];
  for (let i = 0; i < ult.length; i++) {
    if (!c.palabras.includes(ult[i])) continue;
    if (c.noSi.includes(ult[i + 1])) continue;
    return true;
  }
  return false;
}
/** ¿Una regla con permiteNegacion permite esta coincidencia? Devuelve 'negacion' | 'pregunta' | null. */
function permitidaPorNegacion(patron, texto, idx, len, cfg) {
  if (!patron.permiteNegacion) return null;
  if (estaNegada(texto, idx, cfg)) return 'negacion';
  if ((cfg || NEGACION_POR_DEFECTO).permitePregunta !== false && preguntaQueContiene(texto, idx, len)) return 'pregunta';
  return null;
}

/**
 * Revisa un texto. Devuelve [{id, nivel, coincidencia, inicio, fin, contexto, fuente}] con las propiedades
 * `.permitidas` (coincidencias permitidas por permiteNegacion) y `.exentas` (reglas omitidas por excepción de ruta).
 * `opciones.exentas`: Set de ids de frases omitidas (excepción por ruta, ver lib.frasesExentasPorRuta).
 * `opciones.terminos`: Set de palabras (minúsculas) cuya coincidencia exacta se omite (ver lib.terminosExentosPorRuta).
 */
function revisarTexto(texto, comp, urlPagina = null, opciones = {}) {
  const limpio = enmascararExcepciones(texto, comp.mascaras);
  const hallazgos = [];
  const permitidas = [];
  const exentas = [];
  for (const p of comp.patrones) {
    if (p.exceptoRutas && p.exceptoRutas.some((r) => enRuta(urlPagina, r))) continue;
    if (opciones.exentas && opciones.exentas.has(p.id)) { exentas.push(p.id); continue; }
    p.re.lastIndex = 0;
    let m;
    const vistos = new Set();
    while ((m = p.re.exec(limpio))) {
      if (m[0] === '') { p.re.lastIndex++; continue; }
      const permitida = permitidaPorNegacion(p, limpio, m.index, m[0].length, comp.negacion);
      if (permitida) { permitidas.push({ id: p.id, motivo: permitida, coincidencia: m[0].trim() }); continue; }
      const k = m[0].toLowerCase();
      if (opciones.terminos && opciones.terminos.has(k.trim())) { exentas.push(p.id + ':' + k.trim()); continue; }
      if (!vistos.has(k)) {
        vistos.add(k);
        const ini = Math.max(0, m.index - 30);
        const nivelFinal = p.negacion && negado(limpio, m.index) ? p.negacion : p.nivel;
        hallazgos.push({ id: p.id, nivel: nivelFinal, coincidencia: m[0], inicio: m.index, fin: m.index + m[0].length, contexto: texto.slice(ini, m.index + m[0].length + 30).replace(/\s+/g, ' ').trim(), fuente: p.fuente });
      }
    }
  }
  // Una advertencia dentro del tramo de un bloqueante es redundante: se omite.
  const bloq = hallazgos.filter((h) => h.nivel === 'bloqueante');
  const res = hallazgos.filter((h) => h.nivel === 'bloqueante' || !bloq.some((b) => h.inicio >= b.inicio && h.inicio < b.fin));
  res.permitidas = permitidas;
  res.exentas = exentas;
  return res;
}

module.exports = { omitirPreguntasUsuario, regexTextoExacto, compilar, revisarTexto, enmascararExcepciones, enRuta, negado, estaNegada };

if (require.main === module) {
  const reglas = L.leerReglas();
  const R = new L.Reporte('Frases prohibidas (absolutos, fiscal, certificaciones, sectores)');
  let comp;
  try { comp = compilar(reglas); } catch (e) { R.error('release-rules.json', null, e.message); R.terminar(); }
  comp.errores.forEach((e) => R.error('release-rules.json', null, e));
  L.validarExcepcionesPorRuta(reglas).forEach((e) => R.error('release-rules.json', null, e));
  L.validarRutasConSectorPermitido(reglas).forEach((e) => R.error('release-rules.json', null, e));
  if (!comp.patrones.length && !comp.errores.length) R.aviso('release-rules.json', null, '"frasesProhibidas" no existe o está vacía en release-rules.json: no se validan frases.');
  const bloqN = comp.patrones.filter((p) => p.nivel === 'bloqueante').length;
  R.nota(`${comp.patrones.length} patrones (${bloqN} bloqueantes); ${comp.mascaras.length} excepciones enmascaradas.`);
  for (const f of L.listarHtml()) {
    const nombre = L.rel(f);
    const html = L.leer(f);
    const exentas = L.frasesExentasPorRuta(reglas, nombre);
    if (exentas.size) R.nota(`${nombre}: excepción por ruta activa para las frases: ${[...exentas].join(', ')}.`);
    const terminos = L.terminosExentosPorRuta(reglas, nombre);
    if (terminos.size) R.nota(`${nombre}: excepción por ruta activa para las palabras: ${[...terminos].join(', ')}.`);
    const hallazgos = revisarTexto(L.textoAuditable(omitirPreguntasUsuario(html, nombre, reglas)), comp, L.urlDePagina(f), { exentas, terminos });
    for (const p of hallazgos.permitidas) R.nota(`${nombre}: [${p.id}] "${p.coincidencia}" permitida (${p.motivo}).`);
    for (const h of hallazgos) {
      const linea = L.lineaDeFragmento(html, h.coincidencia);
      const msg = `[${h.id}] "${h.coincidencia}" — «…${h.contexto}…». ${h.fuente ? 'Regla: ' + h.fuente + '. ' : ''}${h.nivel === 'bloqueante' ? 'Corrige el texto o, si es correcto, pide al responsable de contenido que actualice release-rules.json.' : 'Revisión humana.'}`;
      if (h.nivel === 'bloqueante') R.error(nombre, linea, 'Frase prohibida ' + msg);
      else R.aviso(nombre, linea, 'Frase a revisar ' + msg);
    }
  }
  R.terminar();
}
