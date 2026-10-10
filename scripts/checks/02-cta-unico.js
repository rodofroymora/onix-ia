#!/usr/bin/env node
'use strict';
/**
 * Check 2 · Exactamente UN CTA primario por página (misma etiqueta y mismo href en todas sus apariciones).
 * CTA primario = <a>/<button> con clase en cta.clasesCtaPrimario (por defecto btn--primary / btn--accent).
 * Repetir el mismo CTA (cabecera, hero, pie, flotante) es válido; dos CTAs DISTINTOS no.
 * Además, el CTA debe coincidir con cta.etiqueta + cta.href de release-rules.json.
 */
const L = require('./lib');
const reglas = L.leerReglas();
const R = new L.Reporte('Un solo CTA primario por página');
const cfg = reglas.cta || {};
const clases = cfg.clasesCtaPrimario || ['btn--primary', 'btn--accent'];
const norm = (s) => s.replace(/\s+/g, ' ').trim();

if (!cfg.etiqueta || !cfg.href) R.aviso('release-rules.json', null, 'cta.etiqueta / cta.href vacíos (TODO CEO/Marketing): solo se valida que haya un único CTA por página.');

for (const f of L.listarHtml()) {
  const nombre = L.rel(f);
  const limpio = L.sinComentariosScriptsEstilos(L.leer(f));
  const tags = L.etiquetas(limpio);
  const ctas = [];
  for (const t of tags) {
    if (t.tag !== 'a' && t.tag !== 'button') continue;
    const cls = (t.attrs.class || '').split(/\s+/);
    if (!clases.some((c) => cls.includes(c))) continue;
    const etiqueta = norm(L.textoSinSrOnly(L.contenidoElemento(limpio, t)));
    let href;
    if (t.tag === 'a') href = t.attrs.href || '(sin href)';
    else {
      const esSubmit = (t.attrs.type || 'submit').toLowerCase() === 'submit';
      if (!esSubmit) href = '(botón sin enlace)';
      else if (cfg.contarBotonesSubmitDeFormulario === false) continue;
      else {
        // busca el <form> anterior más cercano
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
    const k = c.etiqueta + ' ⇒ ' + c.href;
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
  R.nota(`${nombre}: ${ctas.length} aparición(es) de CTA primario, ${distintos.size} distinto(s).`);
}
R.terminar();
