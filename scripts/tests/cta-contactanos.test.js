#!/usr/bin/env node
'use strict';
/**
 * Pruebas de la excepción de CTA «Contáctanos» como ancla interna (cta.excepciones → contactanos-ancla-interna, H-28).
 * Uso: node scripts/tests/cta-contactanos.test.js   (Node 20, sin dependencias)
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
prueba('config real: existe la excepción contactanos-ancla-interna', base.cta.excepciones.some((e) => e.id === 'contactanos-ancla-interna'), true);

const WA = 'https://wa.me/522227097945?text=Hola%2C%20quiero%20informaci%C3%B3n';
const BTN = (extra) => `<a href="${WA}" class="btn btn--accent"${extra || ''}>Escríbenos por WhatsApp</a>`;
const CONT = (href, cls, texto) => `<a href="${href}" class="${cls || 'btn btn--accent'}">${texto === undefined ? 'Contáctanos' : texto}</a>`;
const pagina = (cuerpo) => `<!doctype html><html lang="es"><head><title>t</title></head><body><header>${cuerpo.cab || ''}</header><main><h1>Hola</h1>${cuerpo.main || ''}</main><footer>${cuerpo.pie || ''}</footer>${cuerpo.flot || ''}</body></html>`;

function correr(html, ajustes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-ctn-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const r = JSON.parse(JSON.stringify(base));
  if (ajustes) ajustes(r);
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(r));
  fs.writeFileSync(path.join(tmp, 'index.html'), html);
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', '02-cta-unico.js')], { cwd: tmp, encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_ACTIONS: '' }) });
  fs.rmSync(tmp, { recursive: true, force: true });
  return p.status;
}
const sinExc = (r) => { r.cta.excepciones = r.cta.excepciones.filter((e) => e.id !== 'contactanos-ancla-interna'); };
const seccionWa = '<section class="cta"><div class="cta__act" id="escribenos">' + BTN() + '</div></section>';

// ── Positivos
prueba('menú + menú móvil + flotante «Contáctanos» → #escribenos (contenedor del botón): pasa', correr(pagina({ cab: CONT('#escribenos'), main: seccionWa, flot: CONT('#escribenos', 'btn btn--accent wa-float') })), 0);
prueba('ancla al propio botón de WhatsApp (id en el <a>): pasa', correr(pagina({ cab: CONT('#wa'), main: BTN(' id="wa"') })), 0);
prueba('ancla a la sección que contiene el botón: pasa', correr(pagina({ cab: CONT('#contacto'), main: `<section id="contacto"><div><p>x</p>${BTN()}</div></section>` })), 0);
prueba('con btn--primary también cuenta como exenta', correr(pagina({ cab: CONT('#escribenos', 'btn btn--primary'), main: seccionWa })), 0);
prueba('texto con espacios/saltos alrededor sigue siendo «Contáctanos»', correr(pagina({ cab: CONT('#escribenos', 'btn btn--accent', '\n  Contáctanos  '), main: seccionWa })), 0);

// ── Negativos: SIGUE contando como CTA (falla)
prueba('sin la excepción en la config → falla', correr(pagina({ cab: CONT('#escribenos'), main: seccionWa }), sinExc), 1);
prueba('texto distinto «Hablemos» → falla', correr(pagina({ cab: CONT('#escribenos', 'btn btn--accent', 'Hablemos'), main: seccionWa })), 1);
prueba('texto «contáctanos» (minúscula) → falla', correr(pagina({ cab: CONT('#escribenos', 'btn btn--accent', 'contáctanos'), main: seccionWa })), 1);
prueba('texto «Contactanos» (sin acento) → falla', correr(pagina({ cab: CONT('#escribenos', 'btn btn--accent', 'Contactanos'), main: seccionWa })), 1);
prueba('texto «Contáctanos ahora» → falla', correr(pagina({ cab: CONT('#escribenos', 'btn btn--accent', 'Contáctanos ahora'), main: seccionWa })), 1);
prueba('href «/#escribenos» (con barra) → falla', correr(pagina({ cab: CONT('/#escribenos'), main: seccionWa })), 1);
prueba('href absoluto a la página → falla', correr(pagina({ cab: CONT('https://onix-ia.com/#escribenos'), main: seccionWa })), 1);
prueba('href «#» solo → falla', correr(pagina({ cab: CONT('#'), main: seccionWa })), 1);
prueba('id inexistente → falla', correr(pagina({ cab: CONT('#no-existe'), main: seccionWa })), 1);
prueba('id existe pero NO contiene el botón de WhatsApp → falla', correr(pagina({ cab: CONT('#otro'), main: seccionWa + '<div id="otro"><p>nada</p></div>' })), 1);
prueba('id en <body> (contiene el botón, pero no vale) → falla', correr(`<!doctype html><html lang="es"><head><title>t</title></head><body id="todo"><header>${CONT('#todo')}</header><main><h1>Hola</h1>${BTN()}</main></body></html>`), 1);
prueba('id en <main> (contiene el botón, pero no vale) → falla', correr(`<!doctype html><html lang="es"><head><title>t</title></head><body><header>${CONT('#m')}</header><main id="m"><h1>Hola</h1>${BTN()}</main></body></html>`), 1);
prueba('página sin botón de WhatsApp (solo anclas) → falla', correr(pagina({ cab: CONT('#escribenos'), main: '<div id="escribenos"></div>' })), 1);
prueba('«Contáctanos» a otra URL (https://wa.me/otro) → falla', correr(pagina({ cab: CONT('https://wa.me/520000000000', 'btn btn--accent'), main: seccionWa })), 1);
prueba('«Contáctanos» apuntando al WhatsApp aprobado (no es ancla «#») → falla (etiqueta distinta de la aprobada)', correr(pagina({ cab: CONT(WA), main: seccionWa })), 1);
prueba('ancla «#escribenos» con OTRO texto de CTA primario («Escríbenos por WhatsApp») → falla', correr(pagina({ cab: CONT('#escribenos', 'btn btn--accent', 'Escríbenos por WhatsApp'), main: seccionWa })), 1);
prueba('<button class="btn--accent">Contáctanos</button> → falla (solo cuentan enlaces <a>)', correr(pagina({ cab: '<button type="button" class="btn btn--accent">Contáctanos</button>', main: seccionWa })), 1);
prueba('otro CTA distinto sigue fallando aunque haya anclas válidas', correr(pagina({ cab: CONT('#escribenos'), main: seccionWa + '<a href="/servicios" class="btn btn--accent">Ver servicios</a>' })), 1);
prueba('«Contáctanos» sin clase de CTA primario no cambia nada (no cuenta)', correr(pagina({ cab: CONT('#no-existe', 'btn btn--go'), main: seccionWa })), 0);
prueba('el check sigue exigiendo el CTA aprobado: botón con etiqueta distinta → falla', correr(pagina({ cab: CONT('#escribenos'), main: '<div id="escribenos"><a href="' + WA + '" class="btn btn--accent">Hablemos</a></div>' })), 1);

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron.` : '\n✔ Todas las pruebas de «Contáctanos» pasaron.');
process.exit(fallos ? 1 : 0);
