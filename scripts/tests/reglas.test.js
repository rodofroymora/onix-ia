#!/usr/bin/env node
'use strict';
/**
 * Pruebas locales de: centinela de listas aprobadas, sector exacto ("clínica" ≠ "clínicas"),
 * excepción del WhatsApp aprobado (+52 …) y check 05 de frases prohibidas.
 * Uso: node scripts/tests/reglas.test.js   (Node 20, sin dependencias)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('../checks/lib');
const { compilarReglas, aplicarReglas } = require('../checks/05-frases-prohibidas');

const raiz = path.resolve(__dirname, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};

// ── 1) Centinela y listas
prueba('lista vacía = desactivada', L.listaAprobada([]).activa, false);
prueba('lista inexistente = desactivada', L.listaAprobada(undefined).activa, false);
prueba('centinela activa la validación', L.listaAprobada(['__NINGUNA_APROBADA__']).activa, true);
prueba('centinela no aprueba nada', L.listaAprobada(['__NINGUNA_APROBADA__']).valores, []);
prueba('centinela masculino reconocido', L.esCentinela('__NINGUNO_APROBADO__'), true);
prueba('texto normal no es centinela', L.esCentinela('clínica'), false);
prueba('lista con valor real', L.listaAprobada(['clínica']).valores, ['clínica']);

// ── 2) Sector exacto
prueba('sector: clínica == Clínica', L.normalizarSector('clínica') === L.normalizarSector('Clínica'), true);
prueba('sector: clínica != clínicas', L.normalizarSector('clínica') === L.normalizarSector('clínicas'), false);

// ── 3) WhatsApp aprobado no es cifra
const fmt = base.whatsapp.formatosVisiblesPermitidos;
prueba('quita "+52 222 709 7945"', L.quitarFormatosWhatsapp('Escribe al +52 222 709 7945 hoy', fmt).replace(/\s+/g, ' ').trim(), 'Escribe al hoy');
prueba('no quita número distinto', L.quitarFormatosWhatsapp('Llama al +52 222 709 7946', fmt).includes('+52'), true);
prueba('no quita si hay dígitos pegados', L.quitarFormatosWhatsapp('12227097945', fmt), '12227097945');

// ── 4) Reglas de frases (con las reglas reales)
const { reglas, errores } = compilarReglas(base.frasesProhibidas);
prueba('todas las reglas compilan', errores, []);
prueba('hay reglas bloqueantes y advertencias', [reglas.some((r) => r.nivel === 'bloqueante'), reglas.some((r) => r.nivel === 'advertencia')], [true, true]);
const hits = (t) => aplicarReglas(reglas, t).map((h) => h.id + ':' + h.nivel[0]);
const casos = [
  ['reduce 30% el tiempo', 'porcentaje:b'],
  ['3x más prospectos', 'multiplicador:b'],
  ['+50 clientes', 'conteo-clientes:b'],
  ['ahorra hasta 40 horas al mes', 'ahorro-o-resultado:b'],
  ['desde $5,000 MXN', 'precio:b'],
  ['entrega en 4–6 semanas', 'plazo-numerico:b'],
  ['Pedir diagnóstico Fase 0', 'fase-numerada:b'],
  ['Atención 24/7', '24-7:b'],
  ['pausa inmediata del asistente', 'inmediatez:b'],
  ['ningún mensaje perdido', 'absoluto-cobertura:b'],
  ['nadie se quede sin respuesta', 'claim-nadie-se-quede:a'],
  ['verificamos que tus CFDI estén vigentes', 'fiscal-juicio:b'],
  ['compártenos tu e.firma', 'credenciales-sat:b'],
  ['calculamos tus impuestos', 'impuestos-calculo:b'],
  ['clasificación fiscal automática', 'clasificacion-fiscal:b'],
  ['Secretaria AI', 'secretaria:b'],
  ['Atención con IA por voz', 'nombre-anterior:a'],
  ['certificados en ISO/IEC 42001', 'certificacion-afirmada:b'],
  ['alineado a NIST AI RMF', 'nist-publico:b'],
  ['resultados garantizados', 'garantia:b'],
  ['Pedido confirmado', 'ventas-cobros-inventario:b'],
  ['se integra automáticamente con tu CRM', 'integracion-automatica:a'],
  ['operamos contigo en tus oficinas', 'personal-en-sitio:b'],
  ['soluciones para clínicas', 'clinica-fuera-de-linea:a'],
  ['Caso real', 'caso-real:a'],
  ['XAXX010101000', 'rfc-formato-real:b'],
  ['folio 123e4567-e89b-12d3-a456-426614174000', 'uuid-real:b'],
  ['pipeline STT + LLM', 'jerga-tecnica:a'],
  ['el asistente virtual', 'asistente-masculino:a'],
];
for (const [texto, esperado] of casos) prueba(`detecta [${esperado}] en «${texto}»`, hits(texto).includes(esperado), true);
for (const t of ['Entregado a una clínica · Publicado con autorización del cliente', 'ONIX no está certificado y no certifica', 'ISO/IEC 42001 e ISO/IEC 27001', 'Tres pasos claros', 'Folio XXXX-XXXX', 'Escríbenos por WhatsApp'])
  prueba(`sin falsos positivos en «${t}»`, hits(t), []);
prueba('la línea exacta de la clínica no avisa', hits('Entregado a una clínica').includes('clinica-fuera-de-linea:a'), false);

// ── 5) Integración: checks 01 y 05 sobre un sitio mínimo temporal
function correr(check, html, ajustes) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reglas-test-'));
  fs.cpSync(path.join(raiz, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  const r = JSON.parse(JSON.stringify(base));
  if (ajustes) ajustes(r);
  fs.writeFileSync(path.join(tmp, 'release-rules.json'), JSON.stringify(r));
  fs.writeFileSync(path.join(tmp, 'index.html'), `<!doctype html><html lang="es"><head><title>t</title></head><body><main><h1>Hola</h1><p>${html}</p></main></body></html>`);
  const p = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'checks', check)], { cwd: tmp, encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return p.status;
}
const c01 = (h, aj) => correr('01-cifras-consistencia.js', h, aj);
const c05 = (h, aj) => correr('05-frases-prohibidas.js', h, aj);
prueba('01: texto limpio pasa', c01('Escríbenos y platicamos.'), 0);
prueba('01: "+52 222 709 7945" visible NO falla como cifra', c01('Escríbenos al +52 222 709 7945.'), 0);
prueba('01: "222 709 7945" visible pasa', c01('Escríbenos al 222 709 7945.'), 0);
prueba('01: otro "+NN" sí falla (centinela)', c01('Más de +50 aliados.'), 1);
prueba('01: porcentaje falla con centinela', c01('Mejora de 30%.'), 1);
prueba('01: plazo falla con centinela', c01('Listo en 2 semanas.'), 1);
prueba('01: 24/7 falla con centinela', c01('Atención 24/7.'), 1);
prueba('01: precio falla con centinela', c01('Desde $5,000 MXN.'), 1);
prueba('01: sin centinela y lista vacía, no se valida', c01('Mejora de 30%.', (r) => { r.cifrasAprobadas = []; }), 0);
prueba('01: sector aprobado "clínica" pasa', c01('Entregado a una clínica · Publicado con autorización del cliente.'), 0);
prueba('01: "clínicas" NO pasa aunque "clínica" esté aprobada', c01('Servicios para clínicas.'), 1);
prueba('01: sector no aprobado falla', c01('Servicios para despachos.'), 1);
prueba('01: sectores con centinela: "clínica" falla', c01('Una clínica.', (r) => { r.sectoresPermitidos = ['__NINGUNO_APROBADO__']; }), 1);
prueba('05: texto limpio pasa', c05('Platicamos sobre tu operación.'), 0);
prueba('05: bloqueante falla', c05('Resultados garantizados.'), 1);
prueba('05: advertencia no bloquea', c05('Atención con IA por voz.'), 0);
prueba('05: advertencia pasa a bloqueante si se cambia el nivel', c05('Atención con IA por voz.', (r) => { r.frasesProhibidas.find((f) => f.id === 'nombre-anterior').nivel = 'bloqueante'; }), 1);
prueba('05: regex inválida es error de configuración', c05('hola', (r) => { r.frasesProhibidas.push({ id: 'mala', nivel: 'bloqueante', regex: '(', flags: 'giu' }); }), 1);
prueba('05: nivel inválido es error de configuración', c05('hola', (r) => { r.frasesProhibidas.push({ id: 'x', nivel: 'otro', regex: 'zzz', flags: 'giu' }); }), 1);

if (fallos) { console.log(`\n✖ ${fallos} prueba(s) fallaron.`); process.exit(1); }
console.log('\n✔ Todas las pruebas de reglas pasaron.');
