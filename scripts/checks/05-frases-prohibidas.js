#!/usr/bin/env node
'use strict';
/**
 * Check 5 · Frases prohibidas (release-rules.json → frasesProhibidas).
 * Cada regla: { id, nivel: "bloqueante" | "advertencia", regex, flags, ejemplo, fuente }.
 * Se aplica al mismo texto auditable que usa el check 01 (texto visible + title + metas + alt/aria-label/title).
 *   · bloqueante  → error (falla el check y bloquea el PR)
 *   · advertencia → aviso (se muestra, no bloquea)
 * Una regla con regex inválida, nivel desconocido o sin id es un ERROR de configuración.
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
    reglas.push({ id, nivel: f.nivel, re, ejemplo: f.ejemplo, fuente: f.fuente });
  });
  return { reglas, errores };
}

/** Aplica las reglas a un texto: [{id, nivel, coincidencia, contexto}] (una por coincidencia única y regla). */
function aplicarReglas(reglas, texto) {
  const res = [];
  for (const r of reglas) {
    r.re.lastIndex = 0;
    const vistos = new Set();
    let m;
    while ((m = r.re.exec(texto))) {
      if (m[0] === '') { r.re.lastIndex++; continue; }
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

module.exports = { compilarReglas, aplicarReglas };

if (require.main === module) {
  const reglasJson = L.leerReglas();
  const { reglas, errores } = compilarReglas(reglasJson.frasesProhibidas);
  errores.forEach((e) => R.error('release-rules.json', null, e));
  if (!Array.isArray(reglasJson.frasesProhibidas) || !reglasJson.frasesProhibidas.length) R.aviso('release-rules.json', null, '"frasesProhibidas" está vacía o no existe: no se valida ninguna frase.');
  const bloq = reglas.filter((r) => r.nivel === 'bloqueante').length;
  R.nota(`${reglas.length} regla(s) cargadas (${bloq} bloqueantes, ${reglas.length - bloq} advertencias).`);
  for (const f of L.listarHtml()) {
    const nombre = L.rel(f);
    const html = L.leer(f);
    for (const h of aplicarReglas(reglas, L.textoAuditable(html))) {
      const msg = `[${h.id}] "${h.coincidencia}" — «…${h.contexto}…»`;
      const linea = L.lineaDeFragmento(html, h.coincidencia);
      if (h.nivel === 'bloqueante') R.error(nombre, linea, 'Frase prohibida ' + msg);
      else R.aviso(nombre, linea, 'Frase a revisar ' + msg);
    }
  }
  R.terminar();
}
