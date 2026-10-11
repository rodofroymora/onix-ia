#!/usr/bin/env node
'use strict';
/**
 * Pruebas locales de: check 06 (textos obligatorios: demo, aviso contable, aviso de privacidad cerca de WhatsApp)
 * y de la excepción POR RUTA (solo aviso-de-privacidad.html, solo cifras/plazos/fechas).
 * Uso: node scripts/tests/textos-y-rutas.test.js   (Node 20, sin dependencias)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('../checks/lib');
const T = require('../checks/06-textos-obligatorios');

const raiz = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
const cfg = base.textosObligatorios;
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};

const WA = 'https://wa.me/522227097945';
const AVISO = '<a href="/aviso-de-privacidad">Aviso de privacidad de ÓNIX</a>';
const pagina = (cuerpo) => `<!doctype html>\n<html lang="es"><head><title>t</title></head>\n<body>\n${cuerpo}\n</body></html>`;
const viol = (rel, cuerpo, c) => T.revisarPagina(rel, pagina(cuerpo), c || cfg);
const reglasDe = (v) => v.map((x) => x.regla);

// ── Configuración real
prueba('configuración de textosObligatorios válida', T.validarConfig(cfg), []);
prueba('configuración inválida detectada (sin definición de demo)', T.validarConfig({ reglas: [] }).length, 1);

// ── A) Páginas demo
const DEMO = '<div id="sa-chat" class="chat">hola</div>';
prueba('demo por id/clase detectada', !!T.esDemo(L.etiquetas(pagina(DEMO)), cfg.paginasDemo), true);
prueba('página sin marcadores NO es demo', !!T.esDemo(L.etiquetas(pagina('<p class="reveal">hola</p><div class="rel">x</div>')), cfg.paginasDemo), false);
prueba('demo sin textos: falta el de datos ficticios', reglasDe(viol('x.html', DEMO)).sort(), ['demo-datos-ficticios']);
prueba('demo con el texto obligatorio pasa', viol('x.html', DEMO + '<p>Datos ficticios, no escribas datos reales.</p>'), []);
prueba('demo: texto con entidades/espacios extra pasa', viol('x.html', DEMO + '<p>Datos&nbsp;ficticios,\n no escribas datos reales</p>'), []);
prueba('demo: variante de mayúsculas NO pasa (literal)', reglasDe(viol('x.html', DEMO + '<p>datos ficticios, no escribas datos reales</p>')), ['demo-datos-ficticios']);
prueba('demo: redacción distinta NO pasa', reglasDe(viol('x.html', DEMO + '<p>Demo con datos ficticios. No escribas datos reales.</p>')), ['demo-datos-ficticios']);
/* La leyenda Ilustrativo ya no se exige en demos: se retiró la prueba de «ilustrativa» en minúscula. */
prueba('demo: el error reporta la línea del marcador', viol('x.html', DEMO)[0].linea, 4);
prueba('página no demo no exige textos', viol('x.html', '<p>Hola</p>'), []);
const cfgExp = JSON.parse(JSON.stringify(cfg)); cfgExp.paginasDemo.paginasExplicitas = ['otra.html'];
prueba('paginasExplicitas: marcada como demo', reglasDe(T.revisarPagina('otra.html', pagina('<p>hola</p>'), cfgExp)).sort(), ['demo-datos-ficticios']);
prueba('paginasExplicitas: otras páginas no', T.revisarPagina('distinta.html', pagina('<p>hola</p>'), cfgExp), []);

// ── B) Aviso contable
const CONT = 'servicios/contabilidad-asistida.html';
prueba('contabilidad sin aviso falla', reglasDe(viol(CONT, '<h1>x</h1>')), ['aviso-contable']);
prueba('contabilidad con aviso pasa', viol(CONT, '<h1>x</h1><p>ÓNIX no presta servicios contables ni fiscales.</p>'), []);
prueba('contabilidad: «Ónix»/«ÓNIX» (mayúsculas) tolerado', viol(CONT, '<p>Ónix no presta servicios contables ni fiscales</p>'), []);
prueba('contabilidad: «ONIX» sin acento NO pasa', reglasDe(viol(CONT, '<p>ONIX no presta servicios contables ni fiscales</p>')), ['aviso-contable']);
prueba('contabilidad: redacción distinta NO pasa', reglasDe(viol(CONT, '<p>ÓNIX no presta servicios contables, fiscales ni de asesoría fiscal</p>')), ['aviso-contable']);
prueba('contabilidad: solo en JSON-LD NO cuenta (no visible)', reglasDe(T.revisarPagina(CONT, '<html><head><script type="application/ld+json">{"d":"ÓNIX no presta servicios contables ni fiscales"}</script></head><body><h1>x</h1></body></html>', cfg)), ['aviso-contable']);
prueba('otras páginas no exigen el aviso contable', viol('index.html', '<p>x</p>'), []);

// ── C) Aviso de privacidad cerca de WhatsApp
const wa = (extra) => `<a href="${WA}${extra || ''}" class="btn">Escríbenos</a>`;
const priv = (c, r) => reglasDe(viol('x.html', c, r));
prueba('WhatsApp sin aviso: falla', priv(`<section>${wa()}</section>`), ['aviso-privacidad-cerca-de-whatsapp']);
prueba('WhatsApp + aviso en el mismo contenedor: pasa', priv(`<section><div>${wa()}<p>${AVISO}</p></div></section>`), []);
prueba('WhatsApp con ?text= + aviso cerca: pasa', priv(`<div class="cta__act">${wa('?text=Hola')}<p>${AVISO}</p></div>`), []);
prueba('aviso con href .html también vale', priv(`<div>${wa()}<a href="/aviso-de-privacidad.html">Aviso de privacidad de ÓNIX</a></div>`), []);
prueba('aviso con texto en minúsculas de ÓNIX vale', priv(`<div>${wa()}<a href="/aviso-de-privacidad">Aviso de privacidad de Ónix</a></div>`), []);
prueba('texto distinto («Aviso de privacidad») NO vale', priv(`<div>${wa()}<a href="/aviso-de-privacidad">Aviso de privacidad</a></div>`), ['aviso-privacidad-cerca-de-whatsapp']);
prueba('texto correcto pero href a otra página NO vale', priv(`<div>${wa()}<a href="/terminos">Aviso de privacidad de ÓNIX</a></div>`), ['aviso-privacidad-cerca-de-whatsapp']);
prueba('el error indica el motivo (href incorrecto)', /no apunta a una página aviso-de-privacidad/.test(viol('x.html', `<div>${wa()}<a href="/terminos">Aviso de privacidad de ÓNIX</a></div>`)[0].msg), true);
prueba('aviso en otra parte de la página (lejos) NO basta', priv(`<main><section><div>${wa()}</div></section><section><div><div><div>x</div></div></div></section><footer><ul><li>${AVISO}</li></ul></footer></main>`), ['aviso-privacidad-cerca-de-whatsapp']);
prueba('<main> nunca cuenta como contenedor/hermano cercano', priv(`<main>${wa()}</main><footer>${AVISO}</footer>`), ['aviso-privacidad-cerca-de-whatsapp']);
prueba('aviso en el 3.er ancestro: pasa', priv(`<section><div>${AVISO}<div><div>${wa()}</div></div></div></section>`), []);
prueba('aviso en el 4.º ancestro: NO pasa (nivelesAncestro=3)', priv(`<section><div>${AVISO}<div><div><div>${wa()}</div></div></div></div></section>`), ['aviso-privacidad-cerca-de-whatsapp']);
const cfg4 = JSON.parse(JSON.stringify(cfg)); cfg4.avisoPrivacidadCercaDeWhatsapp.nivelesAncestro = 4;
prueba('nivelesAncestro=4 sí lo acepta (parametrizable)', priv(`<section><div>${AVISO}<div><div><div>${wa()}</div></div></div></div></section>`, cfg4), []);
prueba('botón flotante hijo de body: aviso en hermano inmediato anterior (footer): pasa', priv(`<footer><p>${AVISO}</p></footer>${wa()}`), []);
prueba('botón flotante hijo de body: aviso en hermano inmediato posterior: pasa', priv(`${wa()}<div>${AVISO}</div>`), []);
prueba('botón flotante hijo de body sin hermano con aviso: falla', priv(`<footer><p>x</p></footer>${wa()}<div>${AVISO}</div>`.replace(`<div>${AVISO}</div>`, '') + `<main>${AVISO}</main>`), ['aviso-privacidad-cerca-de-whatsapp']);
prueba('cada enlace de WhatsApp se evalúa por separado (2 sin aviso = 2 errores)', priv(`<header>${wa()}</header><section>${wa()}</section>`).length, 2);
prueba('otro número de WhatsApp no se evalúa aquí', priv('<a href="https://wa.me/522220000000">x</a>'), []);
prueba('el error reporta la línea del enlace de WhatsApp', viol('x.html', `<p>a</p>\n<div>${wa()}</div>`)[0].linea, 5);

// ── Integración: el check 06 completo sobre un sitio temporal
function sitio(archivos, ajustes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'textos-test-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const r = JSON.parse(JSON.stringify(base));
  if (ajustes) ajustes(r);
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(r));
  for (const [n, c] of Object.entries(archivos)) { fs.mkdirSync(path.dirname(path.join(tmp, n)), { recursive: true }); fs.writeFileSync(path.join(tmp, n), c); }
  return tmp;
}
function correr(tmp, check) {
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', check)], { cwd: tmp, encoding: 'utf8' });
  return p.status;
}
const completa = (cuerpo) => `<!doctype html><html lang="es"><head><title>t</title></head><body><main><h1>Hola</h1>${cuerpo}</main></body></html>`;
{
  const ok = sitio({ 'index.html': completa(`<div>${wa()}<p>${AVISO}</p></div>`), [CONT]: completa('<p>ÓNIX no presta servicios contables ni fiscales</p>') });
  prueba('06 integración: sitio conforme pasa', correr(ok, '06-textos-obligatorios.js'), 0);
  fs.rmSync(ok, { recursive: true, force: true });
  const mal = sitio({ 'index.html': completa(`<div>${wa()}</div>`) });
  prueba('06 integración: falta el aviso de privacidad → falla', correr(mal, '06-textos-obligatorios.js'), 1);
  fs.rmSync(mal, { recursive: true, force: true });
  const sinCont = sitio({ 'index.html': completa('<p>x</p>') });
  prueba('06 integración: página con aviso obligatorio inexistente → falla', correr(sinCont, '06-textos-obligatorios.js'), 1);
  fs.rmSync(sinCont, { recursive: true, force: true });
}

// ── Excepción POR RUTA (solo aviso-de-privacidad.html; solo cifras/plazos/fechas)
const AV = 'aviso-de-privacidad.html';
const LEGAL = '<p>Conservamos tus datos por 12 meses y hasta 3 años por obligación legal. Responderemos en 20 días y en 15 días. Vigente desde el 20 de marzo de 2025. Contacto +52 222 709 7945.</p>';
const run = (archivos, check, aj) => { const t = sitio(archivos, aj); const s = correr(t, check); fs.rmSync(t, { recursive: true, force: true }); return s; };
prueba('ruta: config real de excepcionesPorRuta es válida', L.validarExcepcionesPorRuta(base), []);
prueba('ruta: categorías exentas del aviso', [...L.categoriasExentas(base, AV)].sort(), ['cifras', 'fechas', 'plazos']);
prueba('ruta: otra página no tiene categorías exentas', [...L.categoriasExentas(base, 'index.html')], []);
prueba('ruta: frases exentas del aviso (cifras+plazos)', [...L.frasesExentasPorRuta(base, AV)].sort(), ['24-7', 'conteo-clientes', 'multiplicador', 'plazo-numerico', 'porcentaje']);
prueba('01: plazos legítimos en el aviso pasan', run({ [AV]: completa(LEGAL) }, '01-cifras-consistencia.js'), 0);
prueba('05: plazos legítimos en el aviso pasan', run({ [AV]: completa(LEGAL) }, '05-frases-prohibidas.js'), 0);
prueba('01: los MISMOS plazos en otra página FALLAN', run({ 'index.html': completa(LEGAL) }, '01-cifras-consistencia.js'), 1);
prueba('05: los MISMOS plazos en otra página FALLAN', run({ 'index.html': completa(LEGAL) }, '05-frases-prohibidas.js'), 1);
prueba('01: sin la excepción, el aviso falla', run({ [AV]: completa(LEGAL) }, '01-cifras-consistencia.js', (r) => { delete r.excepcionesPorRuta; }), 1);
prueba('01: cifras (porcentaje) exentas en el aviso', run({ [AV]: completa('<p>Hasta 30% de los casos.</p>') }, '01-cifras-consistencia.js'), 0);
prueba('01: la excepción NO cubre precios en el aviso', run({ [AV]: completa('<p>Cuesta $5,000 MXN.</p>') }, '01-cifras-consistencia.js'), 1);
prueba('01: la excepción NO cubre sectores en el aviso', run({ [AV]: completa('<p>Servicios para despachos.</p>') }, '01-cifras-consistencia.js'), 1);
// Excepción por palabra («tratamiento», «salud») SOLO en el aviso de privacidad
const TXT = '<p>Finalidades del tratamiento. Datos personales sensibles, como datos de salud.</p>';
prueba('config real: términos exentos en el aviso', [...L.terminosExentosPorRuta(base, AV)].sort(), ['salud', 'tratamiento']);
prueba('config real: ninguna otra página tiene términos exentos', [...L.terminosExentosPorRuta(base, 'index.html')], []);
prueba('05: «tratamiento» y «salud» pasan en el aviso', run({ [AV]: completa(TXT) }, '05-frases-prohibidas.js'), 0);
prueba('05: «Tratamiento»/«SALUD» (mayúsculas) también pasan en el aviso', run({ [AV]: completa('<p>Tratamiento. SALUD.</p>') }, '05-frases-prohibidas.js'), 0);
const T1 = '<p>Finalidades del tratamiento.</p>', T2 = '<p>Datos personales sensibles, como datos de salud.</p>';
const cada = (archivo, aj) => [run({ [archivo]: completa(T1) }, '05-frases-prohibidas.js', aj), run({ [archivo]: completa(T2) }, '05-frases-prohibidas.js', aj)];
prueba('05: «tratamiento» y «salud» (cada una por separado) pasan en el aviso', cada(AV), [0, 0]);
prueba('05: cada término FALLA por separado en index.html', cada('index.html'), [1, 1]);
prueba('05: cada término FALLA por separado en servicios/contabilidad-asistida.html', cada('servicios/contabilidad-asistida.html'), [1, 1]);
prueba('05: cada término FALLA en una página de nombre parecido (mi-aviso-de-privacidad.html)', cada('mi-aviso-de-privacidad.html'), [1, 1]);
prueba('05: cada término FALLA en aviso-de-privacidad/otra.html (no es la ruta exacta)', cada('aviso-de-privacidad/otra.html'), [1, 1]);
prueba('05: sin la excepción de términos, el aviso falla con cada término', cada(AV, (r) => { r.excepcionesPorRuta = r.excepcionesPorRuta.filter((e) => !e.terminos); }), [1, 1]);
prueba('05: en /salud pasa «salud» pero «tratamiento» sigue fallando', run({ 'salud.html': completa('<p>Finalidades del tratamiento.</p>') }, '05-frases-prohibidas.js'), 1);
for (const [t, esperado] of [['clínica', 'clinica'], ['clínicas', 'clinica'], ['diagnóstico', 'salud-diagnostico'], ['consultorio', 'sector-fuera-de-ruta'], ['pacientes', 'sector-fuera-de-ruta'], ['profesionales de la salud', 'sector-fuera-de-ruta'], ['expediente clínico', 'salud-lenguaje-legal'], ['orientación médica', 'salud-lenguaje-legal'], ['doctor virtual', 'salud-doctor-virtual'], ['Pedido confirmado', 'ventas-cobros-inventario'], ['cerrar ventas', 'ventas-mencion'], ['Resultados garantizados', 'garantia']])
  prueba(`05: «${t}» sigue FALLANDO en el aviso (${esperado})`, run({ [AV]: completa(`<p>Finalidades del tratamiento y datos de salud. ${t}.</p>`) }, '05-frases-prohibidas.js'), 1);
prueba('05: «tratamiento de salud» (frase más larga con otra regla) no se exime por completo', run({ [AV]: completa('<p>Atención médica y tratamiento.</p>') }, '05-frases-prohibidas.js'), 1);
prueba('guarda: términos fuera de la lista no son exceptuables', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: AV, terminos: ['clínica'] }] }).length, 1);
prueba('guarda: términos en otra ruta no son exceptuables', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: 'index.html', terminos: ['salud'] }] }).length, 1);
prueba('guarda: excepción sin categorias ni terminos es error', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: AV }] }).length, 1);
prueba('guarda: términos inválidos no eximen nada', [...L.terminosExentosPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: AV, terminos: ['clínica'] }] }, AV)], []);
prueba('05: «salud» pasa en /salud (salud.html)', run({ 'salud.html': completa('<p>Asistentes para tu consultorio de salud.</p>') }, '05-frases-prohibidas.js'), 0);
prueba('05: «salud» pasa en /salud/preguntas', run({ 'salud/preguntas.html': completa('<p>Salud</p>') }, '05-frases-prohibidas.js'), 0);
prueba('05: «salud» FALLA en otra página', run({ 'servicios.html': completa('<p>Soluciones de salud para PYMES.</p>') }, '05-frases-prohibidas.js'), 1);
prueba('05: «clínica» FALLA incluso en /salud', run({ 'salud.html': completa('<p>Asistentes para una clínica.</p>') }, '05-frases-prohibidas.js'), 1);
prueba('05: rutasConSectorPermitido con otra ruta es error de configuración', run({ 'index.html': completa('<p>x</p>') }, '05-frases-prohibidas.js', (r) => { r.rutasConSectorPermitido[0].ruta = '/servicios'; }), 1);
prueba('01: la excepción NO cubre otro teléfono en el aviso', run({ [AV]: completa('<p>Llama al 222 555 1234.</p>') }, '01-cifras-consistencia.js'), 1);
prueba('05: la excepción NO cubre otras frases (garantía) en el aviso', run({ [AV]: completa('<p>Resultados garantizados.</p>') }, '05-frases-prohibidas.js'), 1);
prueba('05: la excepción NO cubre precio-frase en el aviso', run({ [AV]: completa('<p>Desde $5,000 MXN.</p>') }, '05-frases-prohibidas.js'), 1);
prueba('guarda: otra ruta en excepcionesPorRuta es error de configuración', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: 'index.html', categorias: ['cifras'] }] }).length, 1);
prueba('guarda: comodín en la ruta es error de configuración', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: '*.html', categorias: ['cifras'] }] }).length >= 1, true);
prueba('guarda: categoría «precios» no es exceptuable', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: AV, categorias: ['precios'] }] }).length, 1);
prueba('guarda: categoría «sectores» no es exceptuable', L.validarExcepcionesPorRuta({ excepcionesPorRuta: [{ id: 'x', archivo: AV, categorias: ['sectores'] }] }).length, 1);
prueba('guarda: una excepción inválida no exime nada', [...L.categoriasExentas({ excepcionesPorRuta: [{ id: 'x', archivo: 'index.html', categorias: ['cifras'] }] }, 'index.html')], []);
prueba('01: config de ruta inválida hace fallar el check', run({ 'index.html': completa('<p>x</p>') }, '01-cifras-consistencia.js', (r) => { r.excepcionesPorRuta = [{ id: 'x', archivo: 'index.html', categorias: ['cifras'] }]; }), 1);

if (fallos) { console.log(`\n✖ ${fallos} prueba(s) fallaron.`); process.exit(1); }
console.log('\n✔ Todas las pruebas de textos obligatorios y excepción por ruta pasaron.');
