#!/usr/bin/env node
'use strict';
/**
 * Check 6 · Textos obligatorios (release-rules.json → textosObligatorios). Todo incumplimiento es ERROR (file:línea).
 *
 * A) reglas[] con aplicaA "paginasDemo": cada PÁGINA DEMO debe contener el texto literal de la regla.
 *    DEFINICIÓN DE PÁGINA DEMO (conservadora y explícita, ver paginasDemo en release-rules.json): una página HTML es
 *    demo si (1) contiene algún elemento cuya clase sea una de paginasDemo.marcadores.clases o cuyo id sea uno de
 *    paginasDemo.marcadores.ids, o (2) está en paginasDemo.paginasExplicitas. Nada más cuenta como demo.
 * B) reglas[] con aplicaA "paginas": cada archivo de `paginas` debe contener el texto literal (y debe existir).
 * C) avisoPrivacidadCercaDeWhatsapp: todo enlace <a href="https://wa.me/522227097945[?text=…]"> debe tener CERCA un
 *    enlace con el texto «Aviso de privacidad de ÓNIX» cuyo href apunte a una página aviso-de-privacidad.
 *    DEFINICIÓN DE «CERCA» (nivelesAncestro, por defecto 3): se busca en (a) los ancestros del enlace de WhatsApp, hasta
 *    `nivelesAncestro` niveles hacia arriba sin llegar a <main>, <body> ni <html> (cada ancestro con todos sus descendientes), y (b) el
 *    elemento HERMANO inmediato anterior y el posterior (con sus descendientes) del enlace de WhatsApp y de su padre
 *    directo, excluyendo <main>, <body> y <html>. Un enlace flotante que cuelga de <body> se evalúa solo por (b).
 *    El ancestro/hermano debe contener un enlace válido; la página en su conjunto NO basta.
 *
 * Coincidencia de textos: se decodifican entidades HTML y se colapsan espacios (incl. &nbsp;). El texto debe coincidir
 * EXACTAMENTE (mayúsculas, acentos, puntuación); solo los tokens de `ignorarMayusculasEn` (p. ej. "ÓNIX") admiten
 * cualquier combinación de mayúsculas/minúsculas. «ONIX» sin acento NO equivale a «ÓNIX». Sin letras pegadas.
 * El texto se busca en el texto visible del <body> (no en JSON-LD, metas ni atributos).
 * Nota de orden: el destino aviso-de-privacidad debe existir para que el check 03 (enlaces) pase.
 */
const L = require('./lib');
const R = new L.Reporte('Textos obligatorios');

function esDemo(tags, cfg) {
  const m = (cfg && cfg.marcadores) || {};
  const clases = new Set(m.clases || []);
  const ids = new Set(m.ids || []);
  for (const t of tags) {
    if ((t.attrs.class || '').split(/\s+/).some((c) => clases.has(c))) return t;
    if (t.attrs.id && ids.has(t.attrs.id)) return t;
  }
  return null;
}

/** Valida la configuración; devuelve lista de errores. */
function validarConfig(cfg) {
  const errs = [];
  if (!cfg || typeof cfg !== 'object') return ['Falta "textosObligatorios" en release-rules.json.'];
  if (!cfg.paginasDemo || !cfg.paginasDemo.marcadores) errs.push('textosObligatorios.paginasDemo.marcadores es obligatorio (define qué es una página demo).');
  (cfg.reglas || []).forEach((r, i) => {
    const id = (r && r.id) || '#' + i;
    if (!r || !r.id || typeof r.texto !== 'string' || !r.texto.trim()) errs.push(`textosObligatorios.reglas "${id}": faltan id/texto.`);
    else if (!['paginasDemo', 'paginas'].includes(r.aplicaA)) errs.push(`textosObligatorios.reglas "${id}": aplicaA debe ser "paginasDemo" o "paginas".`);
    else if (r.aplicaA === 'paginas' && !(Array.isArray(r.paginas) && r.paginas.length)) errs.push(`textosObligatorios.reglas "${id}": "paginas" debe ser una lista no vacía.`);
  });
  const a = cfg.avisoPrivacidadCercaDeWhatsapp;
  if (a) {
    for (const k of ['prefijoHrefWhatsapp', 'textoEnlace', 'hrefAvisoRegex']) if (typeof a[k] !== 'string' || !a[k]) errs.push(`textosObligatorios.avisoPrivacidadCercaDeWhatsapp.${k} es obligatorio.`);
    try { new RegExp(a.hrefAvisoRegex, 'i'); } catch (e) { errs.push('avisoPrivacidadCercaDeWhatsapp.hrefAvisoRegex inválida: ' + e.message); }
  }
  return errs;
}

/** Revisa una página. Devuelve [{regla, linea, msg}]. `rel` = ruta relativa (servicios/x.html). */
function revisarPagina(rel, html, cfg) {
  const out = [];
  const limpio = L.sinComentariosScriptsEstilos(html);
  const tags = L.etiquetas(limpio);
  const visible = L.textoVisible(html);
  const marcador = esDemo(tags, cfg.paginasDemo);
  const explicita = ((cfg.paginasDemo && cfg.paginasDemo.paginasExplicitas) || []).includes(rel);
  const demo = !!marcador || explicita;
  const h1 = tags.find((t) => t.tag === 'h1');
  for (const r of cfg.reglas || []) {
    const aplica = r.aplicaA === 'paginasDemo' ? demo : (r.paginas || []).includes(rel);
    if (!aplica) continue;
    if (!L.contieneLiteral(visible, r.texto, r.ignorarMayusculasEn)) {
      const linea = r.aplicaA === 'paginasDemo' ? (marcador ? marcador.line : 1) : (h1 ? h1.line : 1);
      const ctx = r.aplicaA === 'paginasDemo'
        ? `página DEMO (detectada por ${marcador ? `<${marcador.tag}${marcador.attrs.id ? ' id="' + marcador.attrs.id + '"' : ''}${marcador.attrs.class ? ' class="' + marcador.attrs.class + '"' : ''}>` : 'paginasExplicitas'})`
        : 'página con aviso obligatorio';
      out.push({ regla: r.id, linea, msg: `[${r.id}] Falta el texto obligatorio «${r.texto}» en ${ctx}.` });
    }
  }
  const a = cfg.avisoPrivacidadCercaDeWhatsapp;
  if (a) out.push(...revisarAvisoPrivacidad(html, limpio, a));
  return out;
}

function enlaceAviso(nodo, html, a) {
  const href = nodo.attrs.href || '';
  const texto = L.textoSinSrOnly(html.slice(nodo.innerStart, nodo.innerEnd));
  const textoOk = L.contieneLiteral(texto, a.textoEnlace, a.ignorarMayusculasEn);
  const hrefOk = new RegExp(a.hrefAvisoRegex, 'i').test(href);
  return { textoOk, hrefOk, texto, href };
}

function revisarAvisoPrivacidad(html, limpio, a) {
  const out = [];
  const { nodos } = L.construirArbol(limpio);
  const prefijo = a.prefijoHrefWhatsapp.toLowerCase();
  const niveles = Number.isInteger(a.nivelesAncestro) ? a.nivelesAncestro : 3;
  const regla = 'aviso-privacidad-cerca-de-whatsapp';
  for (const wa of nodos.filter((n) => n.tag === 'a' && (n.attrs.href || '').trim().toLowerCase().startsWith(prefijo))) {
    // (a) ancestros hasta `niveles` sin llegar a <body>
    const zonas = [];
    let cur = wa;
    for (let i = 0; i < niveles && cur.parent && !['main', 'body', 'html', '#raiz'].includes(cur.parent.tag); i++) { cur = cur.parent; zonas.push(cur); }
    // (b) hermanos inmediatos (anterior/posterior) del enlace y de su padre directo
    const base = [wa];
    if (wa.parent && !['main', 'body', 'html', '#raiz'].includes(wa.parent.tag)) base.push(wa.parent);
    for (const n of base) {
      const hs = n.parent ? n.parent.children : [];
      const i = hs.indexOf(n);
      for (const h of [hs[i - 1], hs[i + 1]]) if (h && !['main', 'body', 'html'].includes(h.tag)) zonas.push(h);
    }
    const candidatos = new Set();
    for (const z of zonas) { if (z.tag === 'a') candidatos.add(z); L.descendientes(z).forEach((d) => d.tag === 'a' && candidatos.add(d)); }
    candidatos.delete(wa);
    const evals = [...candidatos].map((c) => ({ c, ...enlaceAviso(c, html, a) }));
    if (evals.some((e) => e.textoOk && e.hrefOk)) continue;
    const textoSinHref = evals.find((e) => e.textoOk && !e.hrefOk);
    const parecido = evals.find((e) => /aviso de privacidad/i.test(e.texto));
    let det = 'No hay ningún enlace «' + a.textoEnlace + '» cerca.';
    if (textoSinHref) det = `Hay un enlace con el texto correcto (línea ${textoSinHref.c.line}) pero su href "${textoSinHref.href}" no apunta a una página aviso-de-privacidad.`;
    else if (parecido) det = `Solo hay un enlace con texto distinto: «${parecido.texto}» (línea ${parecido.c.line}); el texto debe ser «${a.textoEnlace}».`;
    out.push({ regla, linea: wa.line, msg: `[${regla}] Enlace de WhatsApp sin aviso de privacidad cerca (href ${(wa.attrs.href || '').split('?')[0]}). ${det}` });
  }
  return out;
}

module.exports = { revisarPagina, validarConfig, esDemo };

if (require.main === module) {
  const reglas = L.leerReglas();
  const cfg = reglas.textosObligatorios;
  const errs = validarConfig(cfg);
  errs.forEach((e) => R.error('release-rules.json', null, e));
  if (!errs.length) {
    const archivos = L.listarHtml();
    const existentes = new Set(archivos.map((f) => L.rel(f)));
    for (const r of cfg.reglas || []) for (const p of r.paginas || []) if (!existentes.has(p)) R.error(p, null, `[${r.id}] La página exigida por textosObligatorios no existe.`);
    const demos = [];
    for (const f of archivos) {
      const nombre = L.rel(f);
      const html = L.leer(f);
      if (esDemo(L.etiquetas(L.sinComentariosScriptsEstilos(html)), cfg.paginasDemo) || ((cfg.paginasDemo.paginasExplicitas) || []).includes(nombre)) demos.push(nombre);
      for (const v of revisarPagina(nombre, html, cfg)) R.error(nombre, v.linea, v.msg);
    }
    R.nota(`Páginas DEMO detectadas: ${demos.length ? demos.join(', ') : '(ninguna)'}.`);
  }
  R.terminar();
}
