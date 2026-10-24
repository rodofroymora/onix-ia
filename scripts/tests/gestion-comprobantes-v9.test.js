#!/usr/bin/env node
'use strict';
/** Spec v9 «Gestión de Comprobantes con IA»: palabras prohibidas, textos exactos y pregunta del usuario en la demo. */
const path = require('path');
const fs = require('fs');
const { compilar, revisarTexto, omitirPreguntasUsuario } = require('../checks/05-frases-prohibidas');
const reglas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'release-rules.json'), 'utf8'));
const comp = compilar(reglas);
let fallos = 0, n = 0;
const prueba = (nombre, obtenido, esperado) => {
  n++; const ok = JSON.stringify(obtenido) === JSON.stringify(esperado); if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✖'} ${nombre}${ok ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};
const bloq = (t) => revisarTexto(t, comp, '/').filter((h) => h.nivel === 'bloqueante').map((h) => h.id);
const TX = Object.fromEntries(reglas.textosExactosAprobados.map((t) => [t.id, t.texto]));

prueba('las reglas compilan', comp.errores, []);
// Bloqueos (con y sin acento)
for (const [t, id] of [
  ['Llevamos tu contabilidad electrónica', 'fiscal-v9-prohibidas'], ['contabilidad electronica', 'fiscal-v9-prohibidas'],
  ['Te ayuda con el cumplimiento fiscal', 'fiscal-v9-prohibidas'], ['conciliación fiscal automática', 'fiscal-v9-prohibidas'],
  ['conciliacion fiscal', 'fiscal-v9-prohibidas'], ['Evita multas del SAT', 'fiscal-v9-prohibidas'], ['ahorra impuestos', 'fiscal-v9-prohibidas'],
  ['Tu contador virtual', 'fiscal-v9-prohibidas'], ['La IA contadora de tu negocio', 'fiscal-v9-prohibidas'],
  ['No es un contador virtual', 'fiscal-v9-prohibidas'],
  ['Te garantiza orden', 'garantia'], ['Resultado garantizado', 'garantia'],
  ['La IA clasifica tus archivos', 'clasifica-generico'], ['Clasificador de comprobantes', 'clasifica-generico'], ['Clasificación por dominio', 'clasifica-generico'],
  ['La factura está cancelada ante el SAT', 'fiscal-juicio'], ['Quedó cancelada ante el SAT', 'fiscal-vigente-cancelada'], ['Está vigente ante el SAT', 'fiscal-vigente-cancelada'],
  ['vigente en el CFDI', 'fiscal-vigente-cancelada'],
  ['Contabilidad Asistida', 'nombre-anterior-contabilidad'], ['contabilidad asistida', 'nombre-anterior-contabilidad'],
  ['¿Esto es deducible?', 'pregunta-deducible'],
]) prueba(`BLOQUEADO [${id}] «${t}»`, bloq(t).includes(id), true);
// Permitidos: «vigente/cancelada» fuera de sentido fiscal; nombre nuevo; negación del aviso; organiza/ordena
for (const t of [
  'Una copia de una identificación oficial vigente.', 'Publicaremos la versión vigente de este aviso.', 'La reunión quedó cancelada por lluvia.',
  'Gestión de Comprobantes con IA', 'no emite, timbra ni cancela facturas', 'La IA ordena tus archivos por dominio', 'Organizador de comprobantes',
]) prueba(`PERMITIDO «${t}»`, bloq(t), []);
// Textos exactos v9
for (const id of ['aviso-contable-corto-v9', 'aviso-contable-largo-v9', 'respuesta-fiscal-fija-v9'])
  prueba(`texto exacto ${id} no bloquea`, bloq(TX[id]), []);
prueba('aviso largo: variante sin acento no se enmascara', comp.mascaras.some((m) => { m.re.lastIndex = 0; return m.re.test(TX['aviso-contable-largo-v9'].replace('asesoría', 'asesoria')); }), false);
prueba('respuesta fija: variante en minúscula no se enmascara', comp.mascaras.some((m) => { m.re.lastIndex = 0; return m.re.test(TX['respuesta-fiscal-fija-v9'].replace('Esa', 'esa')); }), false);
// Pregunta del usuario
const DEMO = 'demos/contabilidad-asistida.html';
const omit = (h, p) => omitirPreguntasUsuario(h, p, reglas).includes('deducible');
prueba('pregunta en burbuja del usuario (dc-msg--out) en la demo: se omite', omit('<p class="dc-msg dc-msg--out">¿Esto es deducible?</p>', DEMO), false);
prueba('misma pregunta en minúscula inicial: se omite', omit('<p class="dc-msg dc-msg--out">¿esto es deducible?</p>', DEMO), false);
prueba('en respuesta de la asistente (dc-msg--in): NO se omite', omit('<p class="dc-msg dc-msg--in">¿Esto es deducible?</p>', DEMO), true);
prueba('en otra página: NO se omite', omit('<p class="dc-msg dc-msg--out">¿Esto es deducible?</p>', 'index.html'), true);
prueba('con texto extra en la burbuja: NO se omite', omit('<p class="dc-msg dc-msg--out">¿Esto es deducible? Sí, lo es.</p>', DEMO), true);
prueba('clase parecida (dc-msg--outline): NO se omite', omit('<p class="dc-msg--outline">¿Esto es deducible?</p>', DEMO), true);

console.log(fallos ? `\n✖ ${fallos} de ${n} prueba(s) fallaron.` : `\n✔ ${n} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
