#!/usr/bin/env node
'use strict';
/**
 * Check 5 · Frases prohibidas (release-rules.json → frasesProhibidas).
 * Cada regla: { id, nivel: "bloqueante" | "advertencia", regex, flags, ejemplo, fuente }.
 * Se aplica al mismo texto auditable que usa el check 01 (texto visible + title + metas + alt/aria-label/title).
 *   · bloqueante  → error (falla el check y bloquea el PR)
 *   · advertencia → aviso (se muestra, no bloquea)
 * Una regla con regex inválida, nivel desconocido o sin id es un ERROR de configuración.
 *
 * NEGACIONES Y PREGUNTAS (opt-in por regla): una regla con "permiteNegacion": true NO marca una coincidencia que:
 *   · esté NEGADA: en la cláusula que la precede hay una palabra de negación (negacionPermitida.palabras:
 *     no / nunca / jamás / tampoco / ni) dentro de las últimas `ventanaPalabras` palabras antes de la coincidencia
 *     (p. ej. «no es una certificación», «No calcula impuestos», «Nunca solicitamos ni guardamos tu e.firma»), salvo
 *     que la negación vaya seguida de solo/sólo/solamente/únicamente («no solo calculamos…» es afirmación).
 *     La cláusula empieza tras , ; : . ! ? ¿ o tras pero/sino/aunque/excepto/salvo/mientras, así que
 *     «no estamos certificados, pero contamos con certificación ISO» sigue bloqueada.
 *   · esté dentro de una PREGUNTA «¿ … ?» (típica de FAQ): el ¿ abre después del último . ! ? ; anterior y el
 *     siguiente terminador tras la coincidencia es «?».
 * Las reglas SIN el flag (p. ej. ningún cliente sin respuesta, «Pedido confirmado») no se afectan.
 * Las afirmaciones («estamos certificados ISO 27001», «contamos con certificación ISO») siguen bloqueadas.
 *
 * EXCEPCIÓN POR RUTA (release-rules.json → excepcionesPorRuta): en la página indicada se omiten las frases de las
 * categorías exentas (cifras: porcentaje, multiplicador, conteo-clientes; plazos: plazo-numerico, 24-7). Ver lib.js.
 */
const L = require('./lib');
const R = new L.Reporte('Frases prohibidas');

const NIVELES = { bloqueante: 'error', advertencia: 'aviso' };

/** Valida y compila las reglas. Devuelve { reglas: [{id,nivel,re,...}], errores: [string] }. */
function compilarReglas(lista) {
  const reglas = [];
  const errores = [];
  const ids = new Set();
  (Array.isArray(lista) ? lista : []).forEach((f, i) => {
    const id = f && f.id ? String(f.id) : `#${i}`;
    if (!f || !f.id) errores.push(`frasesProhibidas[${i}]: falta "id".`);
    else if (ids.has(f.id)) errores.push(`frasesProhibidas "${id}": id duplicado.`);
    else ids.add(f.id);
    if (!f || !Object.prototype.hasOwnProperty.call(NIVELES, f.nivel)) { errores.push(`frasesProhibidas "${id}": nivel "${f && f.nivel}" inválido (usa "bloqueante" o "advertencia").`); return; }
    let flags = String((f.flags === undefined ? 'giu' : f.flags));
    if (!flags.includes('g')) flags += 'g';
    let re;
    try { re = new RegExp(f.regex, flags); } catch (e) { errores.push(`frasesProhibidas "${id}": regex inválida (${e.message}).`); return; }
    if (f.permiteNegacion !== undefined && typeof f.permiteNegacion !== 'boolean') { errores.push(`frasesProhibidas "${id}": "permiteNegacion" debe ser true o false.`); return; }
    reglas.push({ id, nivel: f.nivel, re, ejemplo: f.ejemplo, fuente: f.fuente, permiteNegacion: f.permiteNegacion === true });
  });
  return { reglas, errores };
}

const TERMINADORES = /[.!?;]/g;
const SEPARADORES_CLAUSULA = /[,;:.!?¿]|(?<![\p{L}\p{N}])(?:pero|sino|aunque|excepto|salvo|mientras)(?![\p{L}\p{N}])/giu;
function ultimoIndice(texto, re, hasta) {
  re.lastIndex = 0;
  let ult = -1, fin = 0, m;
  while ((m = re.exec(texto)) && m.index < hasta) { ult = m.index; fin = m.index + m[0].length; if (m[0] === '') re.lastIndex++; }
  return { ind: ult, fin };
}
/** Cláusula que precede a la coincidencia (incluida la coincidencia). */
function clausulaPrevia(texto, idx, len) {
  const { fin } = ultimoIndice(texto, SEPARADORES_CLAUSULA, idx);
  return texto.slice(fin, idx + len);
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
  const prefijo = clausulaPrevia(texto, idx, 0);
  const palabras = prefijo.split(/\s+/).map(limpiarPalabra).filter(Boolean);
  const ult = c.ventanaPalabras > 0 ? palabras.slice(-c.ventanaPalabras) : [];
  for (let i = 0; i < ult.length; i++) {
    if (!c.palabras.includes(ult[i])) continue;
    if (c.noSi.includes(ult[i + 1])) continue;
    return true;
  }
  return false;
}
/** ¿Una regla con permiteNegacion permite esta coincidencia? Devuelve 'negacion' | 'pregunta' | null. */
function permitidaPorNegacion(regla, texto, idx, len, cfg) {
  if (!regla.permiteNegacion) return null;
  if (estaNegada(texto, idx, cfg)) return 'negacion';
  if ((cfg || NEGACION_POR_DEFECTO).permitePregunta !== false && preguntaQueContiene(texto, idx, len)) return 'pregunta';
  return null;
}

/** Aplica las reglas a un texto: [{id, nivel, coincidencia, contexto}] (una por coincidencia única y regla). */
function aplicarReglas(reglas, texto, opciones) {
  const op = opciones || {};
  const res = [];
  res.exentas = []; // reglas omitidas por excepción de ruta (informativo)
  res.permitidas = []; // coincidencias permitidas por una excepción (informativo)
  for (const r of reglas) {
    if (op.exentas && op.exentas.has(r.id)) { res.exentas.push(r.id); continue; }
    r.re.lastIndex = 0;
    const vistos = new Set();
    let m;
    while ((m = r.re.exec(texto))) {
      if (m[0] === '') { r.re.lastIndex++; continue; }
      const permitida = permitidaPorNegacion(r, texto, m.index, m[0].length, op.negacion);
      if (permitida) { res.permitidas.push({ id: r.id, excepcion: permitida, coincidencia: m[0].trim() }); continue; }
      const k = m[0].trim().toLowerCase();
      if (!vistos.has(k)) {
        vistos.add(k);
        const ctx = texto.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim();
        res.push({ id: r.id, nivel: r.nivel, coincidencia: m[0].trim(), contexto: ctx });
      }
    }
  }
  return res;
}

module.exports = { compilarReglas, aplicarReglas, estaNegada };

if (require.main === module) {
  const reglasJson = L.leerReglas();
  const { reglas, errores } = compilarReglas(reglasJson.frasesProhibidas);
  L.validarExcepcionesPorRuta(reglasJson).forEach((e) => errores.push(e));
  errores.forEach((e) => R.error('release-rules.json', null, e));
  if (!Array.isArray(reglasJson.frasesProhibidas) || !reglasJson.frasesProhibidas.length) R.aviso('release-rules.json', null, '"frasesProhibidas" está vacía o no existe: no se valida ninguna frase.');
  const bloq = reglas.filter((r) => r.nivel === 'bloqueante').length;
  R.nota(`${reglas.length} regla(s) cargadas (${bloq} bloqueantes, ${reglas.length - bloq} advertencias).`);
  for (const f of L.listarHtml()) {
    const nombre = L.rel(f);
    const html = L.leer(f);
    const exentas = L.frasesExentasPorRuta(reglasJson, nombre);
    if (exentas.size) R.nota(`${nombre}: excepción por ruta activa para las frases: ${[...exentas].join(', ')}.`);
    const hallazgos = aplicarReglas(reglas, L.textoAuditable(html), { negacion: reglasJson.negacionPermitida, exentas });
    for (const p of hallazgos.permitidas) R.nota(`${nombre}: [${p.id}] "${p.coincidencia}" permitida (${p.excepcion}).`);
    for (const h of hallazgos) {
      const msg = `[${h.id}] "${h.coincidencia}" — «…${h.contexto}…»`;
      const linea = L.lineaDeFragmento(html, h.coincidencia);
      if (h.nivel === 'bloqueante') R.error(nombre, linea, 'Frase prohibida ' + msg);
      else R.aviso(nombre, linea, 'Frase a revisar ' + msg);
    }
  }
  R.terminar();
}
