#!/usr/bin/env node
'use strict';
/**
 * Check 2 · Exactamente UN CTA primario por página (misma etiqueta y mismo href en todas sus apariciones).
 * CTA primario = <a>/<button> con clase en cta.clasesCtaPrimario (por defecto btn--primary / btn--accent).
 * Repetir el mismo CTA (cabecera, hero, pie, flotante) es válido; dos CTAs DISTINTOS no.
 * Además, el CTA debe coincidir con cta.etiqueta + cta.href de release-rules.json.
 *
 * EXCEPCIÓN (decisión aprobada): la regla del CTA único aplica a los llamados a la acción de MARKETING
 * (solo WhatsApp), NO a los botones de envío de formularios. Quedan excluidos de este check:
 *   · <button type="submit"> (o <button> sin type, que por defecto es submit) y <input type="submit|image">;
 *   · cualquier <button> que esté dentro de un <form>.
 * Esta excepción está documentada en release-rules.json → cta.excepciones (id "boton-submit-formulario")
 * y en CONTRIBUTING.md. Si se quita esa entrada de "excepciones", los submit vuelven a contarse como CTA.
 * EXCEPCIÓN (WhatsApp con mensaje precargado): el href aprobado (https://wa.me/522227097945) también se acepta con
 * el parámetro opcional ?text=... (único parámetro permitido; se compara origen+ruta). Otro número, otra ruta u otro
 * parámetro fallan. Documentada en release-rules.json → cta.excepciones (id "whatsapp-mensaje-precargado").
 * Un <a class="btn--primary"> sigue contando como CTA aunque esté dentro de un <form>.
 * EXCEPCIÓN («Contáctanos» como ancla interna, H-28): un <a href="#id"> con texto exacto «Contáctanos» cuyo id existe y es
 * (o contiene) el botón de WhatsApp aprobado NO cuenta como CTA. Cualquier otro enlace con clase de CTA primario sigue
 * contando. Documentada en release-rules.json → cta.excepciones (id "contactanos-ancla-interna"); ver lib.js.
 */
const L = require('./lib');
const reglas = L.leerReglas();
const R = new L.Reporte('Un solo CTA primario por página');
const cfg = reglas.cta || {};
const clases = cfg.clasesCtaPrimario || ['btn--primary', 'btn--accent'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const EXC_SUBMIT = 'boton-submit-formulario';
const EXC_TEXTO = 'whatsapp-mensaje-precargado';
const permitirTexto = Array.isArray(cfg.excepciones) && cfg.excepciones.some((e) => e && e.id === EXC_TEXTO);
// Un href que coincide con el aprobado (con ?text= opcional) se agrupa bajo el href aprobado
const canon = (hr) => (cfg.href && L.hrefCtaCoincide(hr, cfg.href, permitirTexto) ? cfg.href : hr);
const EXC_ANCLA = 'contactanos-ancla-interna';
const permitirAncla = Array.isArray(cfg.excepciones) && cfg.excepciones.some((e) => e && e.id === EXC_ANCLA);
const excluirSubmit = Array.isArray(cfg.excepciones) && cfg.excepciones.some((e) => e && e.id === EXC_SUBMIT);

if (!cfg.etiqueta || !cfg.href) R.aviso('release-rules.json', null, 'cta.etiqueta / cta.href vacíos (pendiente de aprobación): solo se valida que haya un único CTA por página.');

for (const f of L.listarHtml()) {
  const nombre = L.rel(f);
  const limpio = L.sinComentariosScriptsEstilos(L.leer(f));
  const tags = L.etiquetas(limpio);
  // Rangos <form>…</form> para saber si un botón está dentro de un formulario
  const formularios = [];
  { const re = /<form\b[^>]*>([\s\S]*?)<\/form\s*>/gi; let m; while ((m = re.exec(limpio))) formularios.push([m.index, m.index + m[0].length]); }
  const dentroDeForm = (t) => formularios.some(([a, b]) => t.index > a && t.index < b);
  const ctas = [];
  let excluidos = 0;
  let anclasContactanos = 0;
  const esAncla = permitirAncla ? L.crearDetectorContactanos(limpio, cfg, clases, permitirTexto) : null;
  for (const t of tags) {
    if (t.tag === 'input' && excluirSubmit && ['submit', 'image'].includes((t.attrs.type || '').toLowerCase()) && clases.some((c) => (t.attrs.class || '').split(/\s+/).includes(c))) { excluidos++; continue; }
    if (t.tag !== 'a' && t.tag !== 'button') continue;
    const cls = (t.attrs.class || '').split(/\s+/);
    if (!clases.some((c) => cls.includes(c))) continue;
    if (t.tag === 'button' && excluirSubmit && ((t.attrs.type || 'submit').toLowerCase() === 'submit' || dentroDeForm(t))) { excluidos++; continue; }
    const etiqueta = norm(L.textoSinSrOnly(L.contenidoElemento(limpio, t)));
    if (esAncla && t.tag === 'a' && esAncla(t, etiqueta).exento) { anclasContactanos++; continue; }
    let href;
    if (t.tag === 'a') href = t.attrs.href || '(sin href)';
    else {
      const esSubmit = (t.attrs.type || 'submit').toLowerCase() === 'submit';
      if (!esSubmit) href = '(botón sin enlace)';
      else {
        // (solo llega aquí si la excepción de submit fue retirada de release-rules.json) busca el <form> anterior más cercano
        let accion = '(formulario)';
        for (let i = tags.indexOf(t) - 1; i >= 0; i--) if (tags[i].tag === 'form') { accion = tags[i].attrs.action || '(formulario)'; break; }
        href = 'submit → ' + accion;
      }
    }
    ctas.push({ etiqueta, href, line: t.line });
  }
  if (!ctas.length) { R.error(nombre, null, 'No hay ningún CTA primario (clases ' + clases.join(' / ') + ').'); continue; }
  const distintos = new Map();
  for (const c of ctas) {
    const k = c.etiqueta + ' ⇒ ' + canon(c.href);
    if (!distintos.has(k)) distintos.set(k, []);
    distintos.get(k).push(c.line);
  }
  if (distintos.size > 1) {
    const det = [...distintos.entries()].map(([k, ls]) => `"${k}" (línea ${ls.join(', ')})`).join(' | ');
    R.error(nombre, null, `Hay ${distintos.size} CTAs primarios DISTINTOS; debe haber exactamente uno (misma etiqueta y href): ${det}`);
  }
  if (cfg.etiqueta && cfg.href) {
    for (const [k, ls] of distintos) {
      const [et, hr] = k.split(' ⇒ ');
      if (et !== cfg.etiqueta || hr !== cfg.href) {
        R.error(nombre, ls[0], `CTA "${et}" ⇒ ${hr} no coincide con el CTA aprobado: "${cfg.etiqueta}" ⇒ ${cfg.href}.`);
      }
    }
  }
  R.nota(`${nombre}: ${ctas.length} aparición(es) de CTA primario, ${distintos.size} distinto(s)` + (excluidos ? `; ${excluidos} botón(es)/input(s) de envío de formulario excluido(s) por excepción (cta.excepciones)` : '') + (anclasContactanos ? `; ${anclasContactanos} ancla(s) «Contáctanos» a #id del botón de WhatsApp no cuentan como CTA (cta.excepciones: ${EXC_ANCLA})` : '') + '.');
}
R.terminar();
