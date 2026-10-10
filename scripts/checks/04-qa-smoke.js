#!/usr/bin/env node
'use strict';
/**
 * Check 4 · QA smoke: por página <html lang>, <title>, meta description, exactamente un <h1>,
 * imágenes con alt, sin texto residual (TODO / lorem / placeholder...), y regla de robots/noindex
 * según la rama (release-rules.json → robots.dev / robots.main).
 * Rama: CHECK_BRANCH, o GITHUB_BASE_REF (PR), o GITHUB_REF_NAME, o rama git actual.
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const reglas = L.leerReglas();
const R = new L.Reporte('QA smoke');

// Marcadores en MAYÚSCULAS (TODO, FIXME, XXX, TBD) se buscan sensibles a mayúsculas ("todo" es una palabra normal en español).
const esc = (m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const marcadores = (reglas.marcadoresProhibidos || []).map((m) => ({ m, flags: m === m.toUpperCase() ? 'u' : 'iu', re: new RegExp('(?<![\\p{L}\\p{N}_])' + esc(m) + '(?![\\p{L}\\p{N}_])', m === m.toUpperCase() ? 'u' : 'iu') }));
const titulos = new Map();

for (const f of L.listarHtml()) {
  const nombre = L.rel(f);
  const html = L.leer(f);
  const limpio = L.sinComentariosScriptsEstilos(html);
  const tags = L.etiquetas(limpio);

  const htmlTag = tags.find((t) => t.tag === 'html');
  if (!htmlTag || !(htmlTag.attrs.lang || '').trim()) R.error(nombre, htmlTag && htmlTag.line, 'Falta el atributo lang en <html> (p. ej. lang="es-MX").');
  else if (!/^es\b/i.test(htmlTag.attrs.lang)) R.aviso(nombre, htmlTag.line, `lang="${htmlTag.attrs.lang}" no es español.`);

  const tit = limpio.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
  const tituloTxt = tit ? L.aTexto(tit[1]) : '';
  if (!tituloTxt) R.error(nombre, null, 'Falta <title> o está vacío.');
  else {
    if (tituloTxt.length > 70) R.aviso(nombre, null, `<title> largo (${tituloTxt.length} caracteres; recomendado ≤ 70).`);
    if (titulos.has(tituloTxt)) R.aviso(nombre, null, `<title> duplicado con ${titulos.get(tituloTxt)}: "${tituloTxt}".`);
    titulos.set(tituloTxt, nombre);
  }

  const desc = tags.find((t) => t.tag === 'meta' && (t.attrs.name || '').toLowerCase() === 'description');
  const descTxt = desc ? (desc.attrs.content || '').trim() : '';
  if (!descTxt) R.error(nombre, desc && desc.line, 'Falta <meta name="description"> o está vacía.');
  else if (descTxt.length < 50 || descTxt.length > 175) R.aviso(nombre, desc.line, `meta description de ${descTxt.length} caracteres (recomendado 50–175).`);

  const h1 = tags.filter((t) => t.tag === 'h1');
  if (h1.length === 0) R.error(nombre, null, 'Falta <h1>.');
  else if (h1.length > 1) R.error(nombre, h1[1].line, `Hay ${h1.length} <h1>; debe haber exactamente uno (líneas ${h1.map((x) => x.line).join(', ')}).`);
  else if (!L.aTexto(L.contenidoElemento(limpio, h1[0]))) R.error(nombre, h1[0].line, '<h1> vacío.');

  if (!tags.some((t) => t.tag === 'link' && /canonical/i.test(t.attrs.rel || ''))) R.aviso(nombre, null, 'Sin <link rel="canonical">.');
  if (!tags.some((t) => t.tag === 'meta' && (t.attrs.name || '').toLowerCase() === 'viewport')) R.aviso(nombre, null, 'Sin <meta name="viewport">.');

  for (const t of tags) {
    if (t.tag !== 'img') continue;
    if (!('alt' in t.attrs)) R.error(nombre, t.line, `<img> sin atributo alt (src="${(t.attrs.src || '').slice(0, 60)}"). Usa alt descriptivo o alt="" si es decorativa.`);
    else if (!t.attrs.alt.trim() && t.attrs['aria-hidden'] !== 'true' && t.attrs.role !== 'presentation') R.aviso(nombre, t.line, '<img alt=""> vacío: confirmar que es decorativa.');
  }

  // Texto residual: visible + atributos de texto (alt/title/aria-label/meta content)
  let auditable = L.textoVisible(html) + ' ' + tituloTxt;
  for (const t of tags) {
    for (const a of ['alt', 'title', 'aria-label']) if (t.attrs[a]) auditable += ' ' + L.decodificar(t.attrs[a]);
    if (t.tag === 'meta' && t.attrs.content && /description|title/i.test(t.attrs.name || t.attrs.property || '')) auditable += ' ' + L.decodificar(t.attrs.content);
  }
  for (const { m, re, flags } of marcadores) if (re.test(auditable)) {
    const ctx = auditable.match(new RegExp('.{0,30}(?<![\\p{L}\\p{N}_])' + esc(m) + '(?![\\p{L}\\p{N}_]).{0,30}', flags));
    R.error(nombre, null, `Texto residual/placeholder "${m}" en contenido público: «${ctx ? ctx[0] : ''}».`);
  }
  // Comentarios HTML (visibles en "ver código fuente")
  for (const c of html.matchAll(/<!--([\s\S]*?)-->/g)) {
    for (const { m, re } of marcadores) if (re.test(c[1])) R.aviso(nombre, L.lineaDe(html, c.index), `Comentario HTML con "${m}" (visible en el código fuente público): «${c[1].trim().slice(0, 90)}».`);
  }
}

// --- Regla robots / noindex según rama
const { rama, origen } = L.ramaObjetivo();
const esperadoCfg = reglas.robots || {};
let clave = rama;
if (!rama) {
  R.error(null, null, 'No se pudo determinar la rama. Define CHECK_BRANCH=dev|main.');
} else {
  if (!(rama in esperadoCfg)) {
    clave = 'dev';
    R.aviso(null, null, `Rama "${rama}" no está en release-rules.json → robots; se usa la regla de "dev" (los cambios van a dev primero).`);
  }
  const esperado = esperadoCfg[clave];
  if (!['noindex', 'index'].includes(esperado)) R.error('release-rules.json', null, `robots.${clave} debe ser "noindex" o "index" (valor actual: ${JSON.stringify(esperado)}).`);
  else {
    R.nota(`Rama: ${rama} (fuente: ${origen}) → regla robots esperada: "${esperado}".`);
    // vercel.json
    let hayNoindexHeader = false;
    try {
      const v = JSON.parse(L.leer(path.join(L.ROOT, 'vercel.json')));
      for (const h of v.headers || []) for (const kv of h.headers || []) if (/^x-robots-tag$/i.test(kv.key) && /noindex/i.test(kv.value)) hayNoindexHeader = true;
    } catch (_) { /* check 3 reporta JSON inválido */ }
    // robots.txt
    const rt = path.join(L.ROOT, 'robots.txt');
    let disallowTodo = false;
    if (fs.existsSync(rt)) {
      let ua = false;
      for (const l of L.leer(rt).split(/\r?\n/)) {
        const s = l.replace(/#.*/, '').trim();
        if (/^user-agent:\s*\*/i.test(s)) ua = true;
        else if (/^user-agent:/i.test(s)) ua = false;
        else if (ua && /^disallow:\s*\/\s*$/i.test(s)) disallowTodo = true;
      }
    }
    // meta robots por página
    const paginasNoindex = [];
    for (const f of L.listarHtml()) {
      const tags = L.etiquetas(L.sinComentariosScriptsEstilos(L.leer(f)));
      if (tags.some((t) => t.tag === 'meta' && (t.attrs.name || '').toLowerCase() === 'robots' && /noindex/i.test(t.attrs.content || ''))) paginasNoindex.push(L.rel(f));
    }
    const todas = L.listarHtml().length;
    if (esperado === 'noindex') {
      if (!hayNoindexHeader) R.error('vercel.json', null, 'Rama con regla "noindex": falta el header X-Robots-Tag "noindex, nofollow" en vercel.json.');
      if (!disallowTodo) R.error('robots.txt', null, 'Rama con regla "noindex": robots.txt debe tener "User-agent: *" y "Disallow: /".');
      if (paginasNoindex.length !== todas) R.error(null, null, `Rama con regla "noindex": ${todas - paginasNoindex.length} página(s) sin <meta name="robots" content="noindex">.`);
    } else {
      if (hayNoindexHeader) R.error('vercel.json', null, `Rama "${clave}" debe ser indexable ("index") pero vercel.json envía X-Robots-Tag noindex: al promover a producción onix-ia.com quedaría fuera de Google. Requiere decisión del dueño del sitio: ajustar antes del release.`);
      if (disallowTodo) R.error('robots.txt', null, `Rama "${clave}" debe ser indexable pero robots.txt tiene "Disallow: /".`);
      if (paginasNoindex.length) R.error(null, null, `Rama "${clave}" debe ser indexable pero ${paginasNoindex.length} página(s) tienen <meta name="robots" content="noindex">: ${paginasNoindex.join(', ')}.`);
    }
  }
}
R.terminar();
