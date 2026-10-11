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
const hits = (t) => aplicarReglas(reglas, t, { negacion: base.negacionPermitida }).map((h) => h.id + ':' + h.nivel[0]);
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

// ── 4b) Negaciones y preguntas (solo reglas con permiteNegacion)
const bloqueado = (t, id) => hits(t).some((h) => h.startsWith(id + ':'));
const PERMITE = reglas.filter((r) => r.permiteNegacion).map((r) => r.id).sort();
prueba('reglas con permiteNegacion', PERMITE, ['certificacion-afirmada', 'certificacion-revisar', 'credenciales-sat', 'impuestos-calculo']);
// afirmaciones: siguen BLOQUEADAS
for (const t of ['Estamos certificados ISO 27001', 'Contamos con certificación ISO', 'Somos una empresa certificada', 'Certificados en ISO/IEC 42001', 'No estamos certificados, pero contamos con certificación ISO', 'No solo estamos certificados en ISO 27001, también en 9001', 'Ofrecemos certificación ISO ¿Hablamos?'])
  prueba(`certificacion-afirmada BLOQUEA: «${t}»`, bloqueado(t, 'certificacion-afirmada'), true);
// negaciones y preguntas: permitidas
for (const t of ['No es una certificación ISO', 'ONIX no es un organismo certificador y estos servicios no constituyen una certificación ISO', 'No estamos certificados en ISO 27001', 'No somos una empresa certificada', '¿Tienen certificación ISO?', '¿Esta auditoría me da una certificación ISO? No. Es una revisión alineada', 'Servicios ¿Esta auditoría es una certificación ISO? No'])
  prueba(`certificacion-afirmada PERMITE: «${t}»`, bloqueado(t, 'certificacion-afirmada'), false);
prueba('certificacion-revisar: acento «ó» (Unicode) → coincide con la palabra completa', aplicarReglas(reglas, 'Ofrecemos certificación con sello', { negacion: base.negacionPermitida }).map((h) => h.coincidencia), ['certificación']);
prueba('certificacion-revisar: «no es una certificación» permitido', bloqueado('No es una certificación', 'certificacion-revisar'), false);
prueba('certificacion-revisar: «no es organismo certificador» permitido', bloqueado('ONIX no es organismo certificador', 'certificacion-revisar'), false);
prueba('certificacion-revisar: afirmación sigue en aviso', bloqueado('Ofrecemos certificación para tu equipo', 'certificacion-revisar'), true);
prueba('impuestos-calculo: «No calcula impuestos, retenciones ni contribuciones» permitido', bloqueado('No calcula impuestos, retenciones ni contribuciones', 'impuestos-calculo'), false);
prueba('impuestos-calculo: afirmación BLOQUEADA', bloqueado('Calculamos tus impuestos cada mes', 'impuestos-calculo'), true);
prueba('impuestos-calculo: «no solo calculamos tus impuestos» BLOQUEADA', bloqueado('No solo calculamos tus impuestos, también tu nómina', 'impuestos-calculo'), true);
prueba('credenciales-sat: «Nunca solicitamos ni guardamos tu e.firma ni tu CIEC» permitido', bloqueado('Nunca solicitamos ni guardamos tu e.firma ni tu CIEC', 'credenciales-sat'), false);
prueba('credenciales-sat: afirmación BLOQUEADA', bloqueado('Compártenos tu e.firma y tu CIEC', 'credenciales-sat'), true);
prueba('credenciales-sat: «No dudes: compártenos tu e.firma» BLOQUEADA', bloqueado('No dudes: compártenos tu e.firma', 'credenciales-sat'), true);
prueba('credenciales-sat: pregunta con «e.firma o CIEC» (el punto de e.firma no corta la pregunta) permitida', bloqueado('¿Necesitan mi e.firma o mi CIEC? No. Nunca solicitamos ni guardamos tu e.firma ni tu CIEC.', 'credenciales-sat'), false);
prueba('credenciales-sat: «Nunca … tu e.firma ni tu CIEC» permitido (cada mención)', aplicarReglas(reglas, 'Nunca solicitamos ni guardamos tu e.firma ni tu CIEC.', { negacion: base.negacionPermitida }).length, 0);
prueba('credenciales-sat: afirmación con e.firma y CIEC BLOQUEADA', aplicarReglas(reglas, 'Envíanos tu e.firma y tu CIEC.', { negacion: base.negacionPermitida }).length, 2);
// reglas SIN el flag no admiten negación ni pregunta
prueba('absoluto-cobertura sigue BLOQUEADA aunque haya negación', bloqueado('No dejes que ningún cliente se quede sin respuesta', 'absoluto-cobertura'), true);
prueba('absoluto-cobertura sigue BLOQUEADA en pregunta', bloqueado('¿Quieres que ningún cliente se quede sin respuesta?', 'absoluto-cobertura'), true);
prueba('ventas-cobros-inventario «Pedido confirmado» sigue BLOQUEADA', bloqueado('Pedido confirmado ✅', 'ventas-cobros-inventario'), true);
prueba('ventas-cobros-inventario «cerrar ventas» sigue BLOQUEADA aunque haya negación', bloqueado('No necesitas cerrar ventas por tu cuenta', 'ventas-cobros-inventario'), true);
prueba('garantia (sin flag) bloquea «No garantizamos»', bloqueado('No garantizamos resultados', 'garantia'), true);
prueba('permiteNegacion con valor no booleano es error de configuración', compilarReglas([{ id: 'x', nivel: 'bloqueante', regex: 'zzz', permiteNegacion: 'si' }]).errores.length, 1);
prueba('con ventana 0 no hay negación', aplicarReglas(compilarReglas([{ id: 'x', nivel: 'bloqueante', regex: 'zzz', permiteNegacion: true }]).reglas, 'no zzz', { negacion: { ventanaPalabras: 0, permitePregunta: false } }).length, 1);


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
prueba('01: "clínica" BLOQUEADA en todo el sitio (sin sectores aprobados)', c01('Una clínica.'), 1);
prueba('01: la línea «Entregado a una clínica · Publicado con autorización del cliente» BLOQUEADA', c01('Entregado a una clínica · Publicado con autorización del cliente.'), 1);
prueba('01: "clínicas" BLOQUEADA', c01('Servicios para clínicas.'), 1);
prueba('01: sectoresPermitidos solo con centinela (validación activa, nada aprobado)', base.sectoresPermitidos, ['__NINGUNO_APROBADO__']);
prueba('01: aprobar "clínica" explícitamente NO aprueba "clínicas" (comparación exacta)', c01('Servicios para clínicas.', (r) => { r.sectoresPermitidos = ['clínica']; }), 1);
prueba('01: aprobar "clínica" explícitamente sí aprueba "clínica"', c01('Una clínica.', (r) => { r.sectoresPermitidos = ['clínica']; }), 0);
prueba('01: sector no aprobado falla', c01('Servicios para despachos.'), 1);
prueba('05: texto limpio pasa', c05('Platicamos sobre tu operación.'), 0);
prueba('05: bloqueante falla', c05('Resultados garantizados.'), 1);
prueba('05: advertencia no bloquea', c05('Atención con IA por voz.'), 0);
prueba('05: advertencia pasa a bloqueante si se cambia el nivel', c05('Atención con IA por voz.', (r) => { r.frasesProhibidas.find((f) => f.id === 'nombre-anterior').nivel = 'bloqueante'; }), 1);
prueba('05: regex inválida es error de configuración', c05('hola', (r) => { r.frasesProhibidas.push({ id: 'mala', nivel: 'bloqueante', regex: '(', flags: 'giu' }); }), 1);
prueba('05: nivel inválido es error de configuración', c05('hola', (r) => { r.frasesProhibidas.push({ id: 'x', nivel: 'otro', regex: 'zzz', flags: 'giu' }); }), 1);

if (fallos) { console.log(`\n✖ ${fallos} prueba(s) fallaron.`); process.exit(1); }
console.log('\n✔ Todas las pruebas de reglas pasaron.');
