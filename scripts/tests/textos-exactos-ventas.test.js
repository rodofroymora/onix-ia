#!/usr/bin/env node
'use strict';
/**
 * Spec v8.1 «Atención de ventas y reservaciones con IA»: textosExactosAprobados (coincidencia exacta) y bloqueos
 * de confirmación comercial/sin humano, conexión automática y nombres internos. Corre contra release-rules.json real.
 */
const path = require('path');
const fs = require('fs');
const { compilar, revisarTexto } = require('../checks/05-frases-prohibidas');
const reglas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'release-rules.json'), 'utf8'));
const comp = compilar(reglas);
let fallos = 0, n = 0;
const prueba = (nombre, obtenido, esperado) => {
  n++;
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✖'} ${nombre}${ok ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};
const bloq = (t) => revisarTexto(t, comp, '/').filter((h) => h.nivel === 'bloqueante').map((h) => h.id);

prueba('las reglas compilan', comp.errores, []);
const NEG = 'Negocio Ejemplo';
const permitidos = [
  'Recibimos tu solicitud. Una persona del equipo la confirma y te avisa.',
  `Tu cita quedó confirmada por el equipo de ${NEG}.`,
  'Tu cita quedó confirmada por el equipo de Clínica Dental Sonrisa.',
  'Cuando tu equipo la confirma, la cita se registra en el sistema que ya usas, si permite esta conexión.',
  'Demostración: la confirmación la hace una persona de tu equipo.',
  'Demostración con información de ejemplo. Por favor, no incluyas datos personales reales.',
  `Hola, soy la asistente virtual de ${NEG}. Puedo ayudarte con información y anotar tu solicitud; si prefieres hablar con una persona, dímelo.`,
  `Hola, soy la asistente virtual de ${NEG}. Esta llamada se transcribe para atenderte. Si prefieres que no se transcriba, o hablar con una persona, dime en cualquier momento. Tu aviso de privacidad está disponible en el sitio de ${NEG}; si quieres, te lo envío por mensaje.`,
  'Escríbenos por WhatsApp',
  'Aviso de privacidad de ÓNIX',
];
for (const t of permitidos) prueba(`PERMITIDO «${t.slice(0, 60)}…»`, bloq(t), []);

// Cada texto exacto aprobado debe enmascararse (marcador ⇒ ejemplo).
for (const { id, texto } of reglas.textosExactosAprobados) {
  const t = texto.replace('[negocio]', NEG).replace('[medio]', `el sitio de ${NEG}`);
  prueba(`textoExacto ${id} se enmascara completo`, comp.mascaras.some((m) => { m.re.lastIndex = 0; const x = m.re.exec(t); return x && x[0] === t; }), true);
}

const bloqueados = [
  ['Tu cita quedó confirmada.', 'confirmacion-sin-humano'],
  ['Tu cita quedó confirmada por el sistema.', 'confirmacion-sin-humano'],
  ['Reserva confirmada automáticamente.', 'confirmacion-sin-humano'],
  ['Tu reservación está confirmada, te esperamos.', 'confirmacion-sin-humano'],
  ['Pedido confirmado', 'confirmacion-comercial'],
  ['Compra confirmada', 'confirmacion-comercial'],
  ['Pago confirmado', 'confirmacion-comercial'],
  ['Tu pedido quedó confirmado por el equipo de Negocio Ejemplo.', 'confirmacion-comercial'],
  ['Venta confirmada por una persona', 'confirmacion-comercial'],
  ['La asistente se conecta automáticamente a tu agenda.', 'integracion-automatica'],
  ['Integración automática con tu CRM', 'integracion-automatica'],
  ['Sincroniza con tu sistema', 'integracion-automatica'],
  ['Atención de ventas y reservaciones con IA', 'nombre-interno-servicio'],
  ['Atencion de ventas y reservaciones con IA', 'nombre-interno-servicio'],
  ['Ventas asistidas', 'nombre-interno-servicio'],
  ['La asistente cierra tus ventas', 'ventas-cobros-inventario'],
];
for (const [t, id] of bloqueados) prueba(`BLOQUEADO [${id}] «${t}»`, bloq(t).includes(id), true);

// Exactitud: acentos, mayúsculas, puntuación y marcador acotado.
const variantes = [
  `Tu cita quedo confirmada por el equipo de ${NEG}`, // sin acento ni punto: no es exacto; sí tiene «por el equipo» ⇒ no bloquea
];
prueba('variante sin acento no se enmascara (no es exacta)', comp.mascaras.some((m) => { m.re.lastIndex = 0; return m.re.test(variantes[0]); }), false);
const noExactos = [
  'Recibimos tu solicitud. El equipo la confirma y te avisa.',
  'Recibimos tu solicitud, una persona del equipo la confirma y te avisa.',
  'recibimos tu solicitud. Una persona del equipo la confirma y te avisa.',
  `Tu cita quedó confirmada por el equipo de ${NEG}!`,
  'Tu cita quedó confirmada por el equipo de cualquier negocio que tú quieras.',
  'Demostracion: la confirmación la hace una persona de tu equipo.',
  'Cuando tu equipo la confirma, la cita se registra en el sistema que ya usas.',
];
for (const t of noExactos) prueba(`NO exacto ⇒ sin máscara «${t.slice(0, 55)}…»`, comp.mascaras.some((m) => { m.re.lastIndex = 0; return m.re.test(t); }), false);
prueba('[negocio] no acepta texto en minúsculas', bloq('Tu cita quedó confirmada. Por el equipo de nadie'), ['confirmacion-sin-humano']);
prueba('confirmada sin «por el equipo/una persona» en la misma oración bloquea aunque la oración siguiente lo diga', bloq('Tu cita quedó confirmada. Una persona del equipo te avisa.').includes('confirmacion-sin-humano'), true);
prueba('nombre en sitio «Asistentes de WhatsApp y Voz» permitido', bloq('Asistentes de WhatsApp y Voz'), []);

console.log(fallos ? `\n✖ ${fallos} de ${n} prueba(s) fallaron.` : `\n✔ ${n} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
