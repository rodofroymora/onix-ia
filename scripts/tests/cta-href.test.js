#!/usr/bin/env node
'use strict';
/**
 * Pruebas locales de la regla "whatsapp-mensaje-precargado" (check 02, CTA único).
 *  1) Unitarias de hrefCtaCoincide (positivas y negativas).
 *  2) De integración: copia mínima del repo en un directorio temporal con una página y corre el check 02.
 * Uso: node scripts/tests/cta-href.test.js   (Node 20, sin dependencias)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { hrefCtaCoincide } = require('../checks/lib');

const OK = 'https://wa.me/522227097945';
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = obtenido === esperado;
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre} (esperado ${esperado}, obtenido ${obtenido})`);
};

// 1) Unitarias
for (const h of [OK, OK + '?text=Hola', OK + '?text=Hola%20quiero%20informes', OK + '?text=', OK + '/?text=Hola'.replace('/?', '?')])
  prueba('coincide: ' + h, hrefCtaCoincide(h, OK, true), true);
for (const [n, h] of [
  ['otro número', 'https://wa.me/522220000000?text=Hola'],
  ['otro número sin query', 'https://wa.me/522220000000'],
  ['otra ruta', 'https://wa.me/message/ABC123?text=Hola'],
  ['ruta con prefijo', 'https://wa.me/5222270979450'],
  ['parámetro extra (foo)', OK + '?foo=1'],
  ['parámetro extra junto a text', OK + '?text=Hola&lang=es'],
  ['parámetro extra antes de text', OK + '?lang=es&text=Hola'],
  ['text duplicado', OK + '?text=a&text=b'],
  ['otro dominio', 'https://api.whatsapp.com/send?phone=522227097945&text=Hola'],
  ['dominio parecido', 'https://wa.me.evil.example/522227097945?text=Hola'],
  ['http en vez de https', 'http://wa.me/522227097945?text=Hola'],
  ['fragmento', OK + '?text=Hola#x'],
  ['href vacío', ''],
  ['href inválido', 'no es una url'],
]) prueba('NO coincide: ' + n, hrefCtaCoincide(h, OK, true), false);
prueba('sin la excepción, ?text no coincide', hrefCtaCoincide(OK + '?text=Hola', OK, false), false);
prueba('sin la excepción, href exacto sí coincide', hrefCtaCoincide(OK, OK, false), true);

// 2) Integración con el check 02 real
const raiz = path.resolve(__dirname, '..', '..');
function correr(hrefs, quitarExcepcion) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-test-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const reglas = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
  if (quitarExcepcion) reglas.cta.excepciones = reglas.cta.excepciones.filter((e) => e.id !== 'whatsapp-mensaje-precargado');
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(reglas));
  const enlaces = hrefs.map((h) => `<a class="btn btn--primary" href="${h}">${reglas.cta.etiqueta}</a>`).join('\n');
  fs.writeFileSync(path.join(tmp, 'index.html'), `<!doctype html><html lang="es"><body>${enlaces}</body></html>`);
  const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', '02-cta-unico.js')], { cwd: tmp, encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return r.status;
}
prueba('check 02: href exacto pasa', correr([OK]), 0);
prueba('check 02: ?text=... pasa', correr([OK + '?text=Hola%20ONIX']), 0);
prueba('check 02: apariciones con distintos ?text pasan (mismo CTA)', correr([OK + '?text=Hola', OK + '?text=Informes', OK]), 0);
prueba('check 02: otro número FALLA', correr(['https://wa.me/522220000000?text=Hola']), 1);
prueba('check 02: otra ruta FALLA', correr(['https://wa.me/message/ABC123']), 1);
prueba('check 02: parámetro extra (?foo=1) FALLA', correr([OK + '?foo=1']), 1);
prueba('check 02: text + otro parámetro FALLA', correr([OK + '?text=Hola&lang=es']), 1);
prueba('check 02: sin la excepción, ?text FALLA', correr([OK + '?text=Hola'], true), 1);

if (fallos) { console.log(`\n✖ ${fallos} prueba(s) fallaron.`); process.exit(1); }
console.log('\n✔ Todas las pruebas de la regla CTA pasaron.');
