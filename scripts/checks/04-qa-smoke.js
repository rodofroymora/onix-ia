#!/usr/bin/env node
'use strict';
/**
 * Check 4 · QA smoke: por página <html lang>, <title>, meta description, exactamente un <h1>,
 * imágenes con alt, sin texto residual (TODO / lorem / placeholder...), y regla de robots/noindex
 * según la rama (release-rules.json → robots.dev / robots.main). Hoy ambas son "index": el FUENTE es indexable en dev y
 * en main; el noindex de DEV se inyecta al desplegar (scripts/prepare-deploy.js, DEPLOY_ENV=dev). robots.rutasNoindex (solo /salud) permite que esa
 * ruta sea noindex en una rama indexable; cualquier otra página o header noindex sigue fallando.
 * H-39 (SOLO main): release-rules.json → bloqueosSoloMain. Con CHECK_BRANCH=main falla si el paquete público (páginas .html fuera de demos/,
 * sitemap.xml, robots.txt) contiene un marcador pendiente («FECHA DE VIGENCIA», «borrador», «v3-borrador»…) en cualquier parte del código
 * fuente (texto, atributos, comentarios, JSON-LD). En dev NO bloquea (el marcador existe hasta que corre golive.js).
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
L.validarRutasNoindex(reglas).forEach((e) => R.error('release-rules.json', null, e));
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
    const headersNoindexPermitidos = [], headersNoindexOtros = [];
    try {
      const v = JSON.parse(L.leer(path.join(L.ROOT, 'vercel.json')));
      for (const h of v.headers || []) for (const kv of h.headers || []) if (/^x-robots-tag$/i.test(kv.key) && /noindex/i.test(kv.value)) {
        hayNoindexHeader = true;
        if (L.sourceNoindexPermitido(reglas, h.source)) headersNoindexPermitidos.push(h.source); else headersNoindexOtros.push(h.source);
      }
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
    const paginasNoindexPermitidas = [];
    for (const f of L.listarHtml()) {
      const tags = L.etiquetas(L.sinComentariosScriptsEstilos(L.leer(f)));
      if (tags.some((t) => t.tag === 'meta' && (t.attrs.name || '').toLowerCase() === 'robots' && /noindex/i.test(t.attrs.content || ''))) paginasNoindex.push(L.rel(f));
      if (tags.some((t) => t.tag === 'meta' && (t.attrs.name || '').toLowerCase() === 'robots' && /noindex/i.test(t.attrs.content || '')) && L.rutaNoindexPermitida(reglas, L.urlDePagina(f))) paginasNoindexPermitidas.push(L.rel(f));
    }
    const todas = L.listarHtml().length;
    if (esperado === 'noindex') {
      if (!hayNoindexHeader) R.error('vercel.json', null, 'Rama con regla "noindex": falta el header X-Robots-Tag "noindex, nofollow" en vercel.json.');
      if (!disallowTodo) R.error('robots.txt', null, 'Rama con regla "noindex": robots.txt debe tener "User-agent: *" y "Disallow: /".');
      if (paginasNoindex.length !== todas) R.error(null, null, `Rama con regla "noindex": ${todas - paginasNoindex.length} página(s) sin <meta name="robots" content="noindex">.`);
    } else {
      // robots.rutasNoindex: solo /salud puede ser noindex; todo lo demás sigue fallando.
      const otrasPaginas = paginasNoindex.filter((p) => !paginasNoindexPermitidas.includes(p));
      if (paginasNoindexPermitidas.length || headersNoindexPermitidos.length) R.nota(`robots.rutasNoindex (${(esperadoCfg.rutasNoindex || []).join(', ')}): noindex permitido solo en ${[...paginasNoindexPermitidas, ...headersNoindexPermitidos.map((x) => 'header ' + x)].join(', ')}. /salud NO debe ir a main sin revisión de un abogado humano y el OK escrito del dueño del sitio.`);
      if (headersNoindexOtros.length) R.error('vercel.json', null, `Rama "${clave}" debe ser indexable ("index") pero vercel.json envía X-Robots-Tag noindex en: ${headersNoindexOtros.map((x) => JSON.stringify(x)).join(', ')}. Quedaría fuera de Google. (DEV recibe su noindex al desplegar con DEPLOY_ENV=dev, no en el fuente.) Solo se permite noindex acotado a las rutas de robots.rutasNoindex. Requiere decisión del dueño del sitio: ajustar antes del release.`);
      if (disallowTodo) R.error('robots.txt', null, `Rama "${clave}" debe ser indexable pero robots.txt tiene "Disallow: /".`);
      // Fuente production-ready (BLOQUEANTE, igual en dev y en main): sitemap.xml existe y robots.txt lo referencia con una
      // línea «Sitemap: <URL absoluta https …/sitemap.xml>» (si release-rules.json → robots.sitemapUrl está definida, debe ser exactamente esa).
      // Se evalúa sobre el robots.txt del FUENTE; el «Disallow: /» que DEV inyecta al desplegar no pasa por aquí.
      const sitemapCfg = esperadoCfg.sitemapUrl;
      if (sitemapCfg !== undefined && !(typeof sitemapCfg === 'string' && /^https:\/\/[^\s/]+\/sitemap\.xml$/.test(sitemapCfg))) R.error('release-rules.json', null, 'robots.sitemapUrl debe ser una URL absoluta https que termine en /sitemap.xml (p. ej. https://www.onix-ia.com/sitemap.xml).');
      const sm = path.join(L.ROOT, 'sitemap.xml');
      const smTxt = fs.existsSync(sm) ? L.leer(sm) : null;
      if (smTxt === null) R.error('sitemap.xml', null, `Rama "${clave}" debe ser indexable: falta sitemap.xml en la raíz.`);
      else if (!/<(urlset|sitemapindex)\b/i.test(smTxt)) R.error('sitemap.xml', null, 'sitemap.xml no es válido: falta <urlset> (o <sitemapindex>).');
      if (!fs.existsSync(rt)) R.error('robots.txt', null, `Rama "${clave}" debe ser indexable: falta robots.txt en la raíz (con «Sitemap: …»).`);
      else {
        const urls = [...L.leer(rt).matchAll(/^[ \t]*sitemap:[ \t]*(\S+)[ \t]*$/gim)].map((m) => m[1]);
        if (!urls.length) R.error('robots.txt', null, `Rama "${clave}" debe ser indexable: robots.txt debe referenciar el sitemap con una línea «Sitemap: ${typeof sitemapCfg === 'string' ? sitemapCfg : 'https://…/sitemap.xml'}».`);
        else if (typeof sitemapCfg === 'string' && !urls.includes(sitemapCfg)) R.error('robots.txt', null, `robots.txt referencia ${urls.map((u) => JSON.stringify(u)).join(', ')} pero release-rules.json → robots.sitemapUrl es ${JSON.stringify(sitemapCfg)}.`);
        else if (typeof sitemapCfg !== 'string' && !urls.some((u) => /^https:\/\/[^\s/]+\/sitemap\.xml$/.test(u))) R.error('robots.txt', null, 'robots.txt: la línea «Sitemap:» debe ser una URL absoluta https que termine en /sitemap.xml.');
        // Coherencia de host: todas las <loc> del sitemap deben estar en el mismo host que la URL del sitemap (evita mezclar www y apex).
        if (smTxt !== null && urls.length) {
          const host = (u) => { try { return new URL(u).host; } catch (_) { return null; } };
          const h0 = host(typeof sitemapCfg === 'string' ? sitemapCfg : urls[0]);
          const otros = [...new Set([...smTxt.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => host(m[1])).filter((h) => h !== h0))];
          if (otros.length) R.error('sitemap.xml', null, `Las <loc> de sitemap.xml deben estar en el host ${h0}; hay otros hosts: ${otros.join(', ')}.`);
        }
      }
      if (otrasPaginas.length) R.error(null, null, `Rama "${clave}" debe ser indexable pero ${otrasPaginas.length} página(s) tienen <meta name="robots" content="noindex">: ${otrasPaginas.join(', ')}.`);
    }
  }
}

// --- H-39 · Bloqueos SOLO en main: el sitio no se puede publicar con marcadores pendientes (fecha de vigencia / borrador)
{
  const cfg = reglas.bloqueosSoloMain;
  const ES_MAIN = rama === 'main';
  const marc = cfg && Array.isArray(cfg.marcadores) ? cfg.marcadores : null;
  const cfgOk = !!(cfg && marc && marc.length && marc.every((x) => x && typeof x.id === 'string' && typeof x.texto === 'string' && x.texto.trim()) && (cfg.archivos === undefined || Array.isArray(cfg.archivos)) && (cfg.excluirRutas === undefined || Array.isArray(cfg.excluirRutas)));
  if (cfg !== undefined && !cfgOk) R.error('release-rules.json', null, 'bloqueosSoloMain mal formado: se espera { marcadores: [{id, texto}…], archivos?: [...], excluirRutas?: [...] }.');
  if (ES_MAIN && cfg === undefined) R.error('release-rules.json', null, 'Falta bloqueosSoloMain: en main es obligatorio (impide publicar con «FECHA DE VIGENCIA» / «borrador»).');
  if (ES_MAIN && cfgOk) {
    const norm = (t) => t.trim().split(/\s+/).map(esc).join('(?:\\s|&nbsp;|&#160;|&#xa0;)+');
    const lista = marc.map((x) => ({ id: x.id, texto: x.texto, re: new RegExp(norm(x.texto), 'giu') }));
    const excl = (cfg.excluirRutas || []).map((x) => String(x).replace(/^\/+/, ''));
    const archivos = L.listarHtml().filter((f) => !excl.some((e) => L.rel(f) === e || L.rel(f).startsWith(e.endsWith('/') ? e : e + '/')));
    for (const a of cfg.archivos || ['sitemap.xml', 'robots.txt']) { const f = path.join(L.ROOT, a); if (fs.existsSync(f)) archivos.push(f); }
    let hits = 0;
    for (const f of archivos) {
      const raw = L.leer(f);
      for (const { id, texto, re } of lista) {
        for (const m of raw.matchAll(re)) {
          hits++;
          const ini = Math.max(0, m.index - 40);
          R.error(L.rel(f), L.lineaDe(raw, m.index), `[H-39 ${id}] Marcador pendiente «${m[0]}» (regla «${texto}») en main: no se puede publicar así. Contexto: …${raw.slice(ini, m.index + m[0].length + 40).replace(/\s+/g, ' ')}…`);
        }
      }
    }
    R.nota(`H-39 (solo main): ${archivos.length} archivo(s) del paquete público revisados (${excl.length ? 'fuera de ' + excl.join(', ') : 'sin exclusiones'}); ${hits} marcador(es) pendiente(s).`);
  } else if (cfgOk) {
    R.nota(`H-39 (bloqueosSoloMain) solo aplica con CHECK_BRANCH=main; en "${rama}" no bloquea.`);
  }
}
R.terminar();
