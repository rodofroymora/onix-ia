#!/usr/bin/env node
'use strict';
/**
 * Casos de prueba entregados por el Arquitecto de soluciones (v3.1, 74 casos) para el check 05, ejecutados contra el
 * release-rules.json del repo. Uso: node scripts/tests/05-frases-arquitecto.test.js [ruta-al-release-rules.json]
 */
const path = require('path');
const fs = require('fs');
const { compilar, revisarTexto } = require('../checks/05-frases-prohibidas');
const ruta = process.argv[2] || path.resolve(__dirname, '..', '..', 'release-rules.json');
const comp = compilar(JSON.parse(fs.readFileSync(ruta, 'utf8')));

// [texto, resultado esperado: 'falla' (≥1 bloqueante) | 'aviso' (0 bloqueantes, ≥1 advertencia) | 'pasa' (nada), id esperado opcional]
const casos = [
  // a) absolutos
  ['Contestamos a cualquier hora, para que nadie se quede sin respuesta.', 'falla', 'absoluto-nadie-sin-respuesta'],
  ['Así nadie queda sin respuesta.', 'falla', 'absoluto-nadie-sin-respuesta'],
  ['Ningún mensaje perdido.', 'falla', 'absoluto-ningun-mensaje'],
  ['Ningún cliente se queda sin respuesta.', 'falla', 'absoluto-ningun-mensaje'],
  ['Nadie de tu equipo tiene que capturar a mano.', 'aviso', 'absoluto-generico'],
  ['Primera conversación sin ningún compromiso.', 'pasa'],
  ['Ninguna decisión con efecto sobre una persona se toma solo con la IA.', 'pasa'],
  ['Para que tus clientes tengan a quién escribirle.', 'pasa'],
  // b) sectores (clínica: nunca pasa)
  ['Caso de éxito de una clínica.', 'falla', 'clinica'],
  ['Soluciones para clínicas.', 'falla', 'clinica'],
  ['Atendemos una clínica dental.', 'falla', 'clinica'],
  // c) clasifica
  ['La IA clasifica tus comprobantes.', 'falla', 'clasificacion-contable-fiscal'],
  ['Clasificación fiscal automática.', 'falla', 'clasificacion-contable-fiscal'],
  ['Clasificación contable de gastos.', 'falla', 'clasificacion-contable-fiscal'],
  ['La IA ordena comprobantes por categoría administrativa.', 'pasa'],
  ['Te ayudamos a clasificar la información.', 'aviso', 'clasifica-generico'],
  // d) excepciones número y correo
  ['Escríbenos por WhatsApp al +52 222 709 7945.', 'pasa'],
  ['WhatsApp 222 709 7945 · info@onix-ia.com', 'pasa'],
  ['https://wa.me/522227097945', 'pasa'],
  ['522227097945', 'pasa'],
  ['52 222 709 7945', 'pasa'],
  ['+522227097945', 'pasa'],
  // resto de reglas
  ['Atención con IA por voz y WhatsApp, 24/7', 'falla', '24-7'],
  ['Pedir diagnóstico Fase 0', 'falla', 'fase-numerada'],
  ['Listo en 4–6 semanas', 'falla', 'plazo-numerico'],
  ['Reduce 30% el tiempo de captura', 'falla', 'porcentaje'],
  ['Desde $5,000 MXN', 'falla', 'precio'],
  ['Se puede pausar de inmediato', 'falla', 'inmediatez'],
  ['Verificamos que tus CFDI estén vigentes', 'falla', 'fiscal-juicio'],
  ['Compártenos tu e.firma para empezar', 'falla', 'credenciales-sat-pedir'],
  ['Nunca pedimos tu e.firma ni tu CIEC.', 'aviso', 'credenciales-sat-mencion'],
  ['Somos certificados en ISO/IEC 42001', 'falla', 'certificacion-afirmada'],
  ['Alineado a marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ONIX no está certificado y no certifica.', 'pasa'],
  ['Secretaria AI', 'falla', 'secretaria'],
  ['Resultados garantizados', 'falla', 'garantia'],
  ['Pedido confirmado', 'falla', 'ventas-cobros-inventario'],
  ['Escríbenos por WhatsApp', 'pasa'],
  // NOTA: «cerrar ventas» y sus formas (ventas-mencion) pasaron de 'aviso' (Arquitecto) a 'falla' por decisión de dirección 2026-10-10.
  // v2.1 (hallazgos de la revisión del PR #7)
  ['Esto no es una certificación.', 'aviso', 'certificacion-revisar', 'certificación'],
  ['Calculamos tu IVA cada mes.', 'falla', 'impuestos-calculo'],
  ['Calculamos tus impuestos.', 'falla', 'impuestos-calculo'],
  ['Las preguntas de siempre consumen el tiempo que debería ir a cerrar ventas.', 'falla', 'ventas-mencion'],
  ['La asistente virtual no cierra ventas ni cobra.', 'falla', 'ventas-mencion'],
  ['No cerramos ventas por ti.', 'falla', 'ventas-mencion'],
  ['La asistente cierra ventas por ti.', 'falla', 'ventas-cobros-inventario'],
  ['¿Esta auditoría me da una certificación ISO? No. Es una revisión alineada a esos marcos.', 'aviso', 'certificacion-revisar'],
  ['Somos una empresa certificada en ISO/IEC 27001.', 'falla', 'certificacion-afirmada'],
  ['Que ningún cliente se quede sin respuesta, por WhatsApp o por teléfono.', 'falla', 'absoluto-ningun-mensaje'],
  ['Revisión por un organismo de certificación acreditado.', 'aviso', 'certificacion-revisar'],
  // v3 · excepción por ruta /salud y lenguaje de salud
  ['Asistentes para tu consultorio de salud.', 'pasa', null, null, '/salud'],
  ['Recordatorios para tus pacientes, aprobados por tu equipo.', 'pasa', null, null, '/salud'],
  ['Asistentes para tu consultorio de salud.', 'falla', 'sector-fuera-de-ruta', null, '/'],
  ['Soluciones de salud para PYMES.', 'falla', 'sector-fuera-de-ruta', null, '/servicios'],
  ['Salud', 'falla', 'sector-fuera-de-ruta', null, '/saludable'],
  ['Salud', 'pasa', null, null, '/salud/preguntas'],
  ['Asistentes para clínicas de salud.', 'falla', 'clinica', null, '/salud'],
  ['Somos la asistente de tu clínica.', 'falla', 'clinica', null, '/salud'],
  ['Te damos un diagnóstico inicial.', 'falla', 'salud-diagnostico', null, '/salud'],
  ['Diagnóstico y ruta.', 'falla', 'salud-diagnostico', null, '/como-trabajamos'],
  ['La asistente virtual no hace diagnósticos.', 'aviso', 'salud-diagnostico', null, '/salud'],
  ['Atención clínica por WhatsApp.', 'falla', 'salud-atencion-clinica', null, '/salud'],
  ['Sin atención clínica: solo citas y avisos administrativos.', 'aviso', 'salud-atencion-clinica', null, '/salud'],
  ['Tu doctor virtual a cualquier hora.', 'falla', 'salud-doctor-virtual', null, '/salud'],
  ['No es un doctor virtual.', 'aviso', 'salud-doctor-virtual', null, '/salud'],
  ['Orientación médica por WhatsApp.', 'falla', 'salud-lenguaje-legal', null, '/salud'],
  ['No damos consejo médico ni atendemos urgencias.', 'aviso', 'salud-lenguaje-legal', null, '/salud'],
  ['Tratamiento de datos personales conforme al aviso de privacidad.', 'pasa', null, null, '/salud'],
  ['Cumple con la NOM.', 'falla', 'salud-cumplimiento', null, '/salud'],
  ['Tomamos la solicitud de cita y una persona de tu equipo la confirma.', 'pasa', null, null, '/salud'],
  // v3.1 · «Diagnóstico» → «Revisión inicial» en todo el sitio (decisión de dirección, opción a)
  ['Ruta IA — Diagnóstico, prioridades y reglas de uso', 'falla', 'salud-diagnostico', null, '/'],
  ['Ruta IA — Diagnóstico, prioridades y reglas de uso', 'falla', 'salud-diagnostico', null, '/servicios/auditoria-de-ia'],
  ['Ruta IA — Revisión inicial, prioridades y reglas de uso', 'pasa', null, null, '/'],
  ['Primero una conversación y una revisión inicial para entender el problema.', 'pasa', null, null, '/'],
  ['Agenda tu revisión inicial.', 'pasa', null, null, '/salud'],
  ['Sin diagnóstico: solo citas y avisos administrativos.', 'aviso', 'salud-diagnostico', null, '/salud'],
];

let ok = 0; const malos = [];
for (const [texto, esperado, id, coincide, ruta] of casos) {
  const h = revisarTexto(texto, comp, ruta || '/');
  const bloq = h.filter((x) => x.nivel === 'bloqueante');
  const obtenido = bloq.length ? 'falla' : h.length ? 'aviso' : 'pasa';
  const idOk = (!id || h.some((x) => x.id === id)) && (!coincide || h.some((x) => x.id === id && x.coincidencia === coincide));
  if (obtenido === esperado && idOk) ok++;
  else malos.push(`✖ [${ruta || '/'}] «${texto}» esperado=${esperado}${id ? ' (' + id + ')' : ''} obtenido=${obtenido} [${h.map((x) => x.nivel[0].toUpperCase() + ':' + x.id + '="' + x.coincidencia + '"').join(', ')}]`);
}
malos.forEach((m) => console.log(m));
console.log(`\n${ok}/${casos.length} casos OK`);
process.exit(malos.length ? 1 : 0);
