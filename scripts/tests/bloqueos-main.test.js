#!/usr/bin/env node
'use strict';
/**
 * Pruebas de H-39 (release-rules.json → bloqueosSoloMain, check 04): en CHECK_BRANCH=main se bloquea publicar con
 * «FECHA DE VIGENCIA» / «borrador» (incluye «v3-borrador»); en dev NO bloquea. Alcance: páginas .html del paquete público
 * (no demos/), sitemap.xml y robots.txt.
 * Uso: node scripts/tests/bloqueos-main.test.js   (Node 20, sin dependencias)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const raiz = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};
// Página multilínea (para comprobar «archivo:línea»): el cuerpo extra queda en la línea 6.
const pag = (titulo, cuerpoExtra = '', cabezaExtra = '') => `<!doctype html>
<html lang="es"><head><title>${titulo} ÓNIX sitio de prueba</title>
<meta name="description" content="Descripción de prueba suficientemente larga para pasar el check de QA del sitio.">
${cabezaExtra}</head>
<body><main><h1>${titulo}</h1>
${cuerpoExtra}</main></body></html>
`;
const SM = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.onix-ia.com/</loc></url></urlset>';
const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${base.robots.sitemapUrl}\n`;
const limpio = { 'index.html': pag('Inicio', '<p>Texto.</p>'), 'servicios.html': pag('Servicios'), 'vercel.json': '{}', 'robots.txt': ROBOTS, 'sitemap.xml': SM };

function correr(rama, archivos, ajustes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h39-test-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const r = JSON.parse(JSON.stringify(base)); if (ajustes) ajustes(r);
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(r));
  for (const [n, c] of Object.entries(archivos)) { fs.mkdirSync(path.dirname(path.join(tmp, n)), { recursive: true }); fs.writeFileSync(path.join(tmp, n), c); }
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', '04-qa-smoke.js')], { cwd: tmp, encoding: 'utf8', env: Object.assign({}, process.env, { CHECK_BRANCH: rama, GITHUB_ACTIONS: '' }) });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { status: p.status, out: p.stdout };
}
const con = (extra) => Object.assign({}, limpio, extra);

// ── config real
prueba('config real: marcadores = FECHA DE VIGENCIA + -borrador', base.bloqueosSoloMain.marcadores.map((m) => m.texto), ['FECHA DE VIGENCIA', '-borrador']);
prueba('config real: excluye demos/', base.bloqueosSoloMain.excluirRutas, ['demos/']);

// ── casos que DEBEN bloquear en main (y se IGNORAN en dev)
const casos = [
  ['«[FECHA DE VIGENCIA — completar al publicar]» visible', { 'index.html': pag('Inicio', '<p><mark class="pending">[FECHA DE VIGENCIA — completar al publicar]</mark></p>') }, 'index.html:6'],
  ['«fecha de vigencia» en minúsculas', { 'servicios.html': pag('Servicios', '<p>fecha de vigencia pendiente</p>') }, 'servicios.html:6'],
  ['«Fecha De Vigencia» con mayúsculas mezcladas', { 'servicios.html': pag('Servicios', '<p>Fecha De Vigencia</p>') }, 'servicios.html:6'],
  ['«FECHA&nbsp;DE&nbsp;VIGENCIA» con &nbsp;', { 'servicios.html': pag('Servicios', '<p>FECHA&nbsp;DE&nbsp;VIGENCIA</p>') }, 'servicios.html:6'],
  ['«FECHA DE» + salto de línea + «VIGENCIA»', { 'servicios.html': pag('Servicios', '<p>FECHA DE\n   VIGENCIA</p>') }, 'servicios.html:6'],
  ['«v3-borrador» en data-version', { 'index.html': pag('Inicio', '<div class="legal" data-estado="final" data-version="v3-borrador"></div>') }, 'index.html:6'],
  ['«v3-borrador» en input hidden aviso_version', { 'index.html': pag('Inicio', '<form><input type="hidden" name="aviso_version" value="v3-borrador" /></form>') }, 'index.html:6'],
  ['«borrador» en <meta> (metadato)', { 'index.html': pag('Inicio', '<p>x</p>', '<meta name="aviso_version" content="v3-borrador">\n') }, 'index.html:4'],
  ['«FECHA DE VIGENCIA» en comentario HTML', { 'index.html': pag('Inicio', '<!-- FECHA DE VIGENCIA -->\n<p>x</p>') }, 'index.html:6'],
  ['«borrador» en JSON-LD', { 'index.html': pag('Inicio', '<p>x</p>', '<script type="application/ld+json">{"@type":"Organization","version":"v3-borrador"}</script>\n') }, 'index.html:4'],
  ['marcador en una página de subcarpeta', { 'servicios/radar.html': pag('Radar', '<p>aviso v3-borrador</p>') }, 'servicios/radar.html:6'],
  ['marcador en robots.txt (comentario)', { 'robots.txt': ROBOTS + '# v3-borrador\n' }, 'robots.txt:5'],
  ['carpeta que solo se parece a demos/ («demos-ia/») NO está excluida', { 'demos-ia/a.html': pag('Demo', '<p>v3-borrador</p>') }, 'demos-ia/a.html:6'],
  ['marcador en sitemap.xml (comentario)', { 'sitemap.xml': SM.replace('<url>', '<!-- FECHA DE VIGENCIA -->\n<url>') }, 'sitemap.xml:1'],
];
/* Vocabulario del producto: «borrador de cotización» está aprobado en la Matriz base v4
   y aparece en la página de Agentes de Operación. Antes bloqueaba, y la propia suite lo
   tenía documentado como «FALSO POSITIVO conocido». Con el marcador «-borrador» ya no. */
const noBloquean = [
  ['«borrador» suelto (vocabulario de producto)', { 'index.html': pag('Inicio', '<p>Este texto es un borrador.</p>') }],
  ['«BORRADOR» en mayúsculas', { 'index.html': pag('Inicio', '<p>BORRADOR</p>') }],
  ['«borradores» en plural', { 'index.html': pag('Inicio', '<p>Guardamos borradores.</p>') }],
  ['«Borrador de cotización», el caso real de Agentes', { 'index.html': pag('Inicio', '<p>Borrador de cotización listo para que tu equipo lo revise.</p>') }],
];
for (const [n, arch] of noBloquean) {
  const m = correr('main', con(arch));
  prueba('main NO bloquea: ' + n, [m.status, m.out.includes('[H-39')], [0, false]);
}

for (const [n, arch, donde] of casos) {
  const m = correr('main', con(arch));
  prueba(`main BLOQUEA: ${n} → ${donde}`, [m.status, m.out.includes('[H-39') && m.out.includes(donde + ' ')], [1, true]);
  const d = correr('dev', con(arch));
  prueba(`dev IGNORA:   ${n}`, [d.status, d.out.includes('[H-39')], [0, false]);
}
// ── casos que NO deben bloquear
prueba('main: sitio limpio → pasa', correr('main', limpio).status, 0);
prueba('main: «Aprobar borrador» en demos/ (fuera del paquete) → pasa', correr('main', con({ 'demos/aprobar.html': pag('Demo', '<button>Aprobar borrador</button>') })).status, 0);
prueba('main: «borrador» en demos/sub/pagina.html → pasa', correr('main', con({ 'demos/sub/p.html': pag('Demo', '<p>borrador</p>') })).status, 0);
prueba('main: «borrador» en .css/.js (fuera del alcance) → pasa', correr('main', con({ 'site.css': '/* borrador */', 'motion.js': '// borrador' })).status, 0);
prueba('main: otra rama (release) → no aplica', correr('release', con({ 'index.html': pag('Inicio', '<p>borrador</p>') })).status === 1 ? 'bloquea' : 'no bloquea', 'no bloquea');
// ── configuración
const sinBloq = (r) => { delete r.bloqueosSoloMain; };
prueba('main: falta bloqueosSoloMain en release-rules → FALLA (no se puede desactivar borrándola)', [correr('main', limpio, sinBloq).status, /Falta bloqueosSoloMain/.test(correr('main', limpio, sinBloq).out)], [1, true]);
prueba('dev: falta bloqueosSoloMain → no bloquea', correr('dev', limpio, sinBloq).status, 0);
prueba('config mal formada (marcadores vacío) → FALLA incluso en dev', correr('dev', limpio, (r) => { r.bloqueosSoloMain.marcadores = []; }).status, 1);
prueba('config mal formada (marcador sin texto) → FALLA en main', correr('main', limpio, (r) => { r.bloqueosSoloMain.marcadores = [{ id: 'x' }]; }).status, 1);
prueba('config: marcador extra añadido por reglas («PENDIENTE DE LEGAL») se aplica en main', correr('main', con({ 'index.html': pag('Inicio', '<p>pendiente de legal</p>') }), (r) => { r.bloqueosSoloMain.marcadores.push({ id: 'legal', texto: 'PENDIENTE DE LEGAL' }); }).status, 1);

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron.` : '\n✔ Todas las pruebas de bloqueos solo-main (H-39) pasaron.');
process.exit(fallos ? 1 : 0);
