/* Lógica gratuita de la autoevaluación. Sin leyes ni versiones de pago.
   Fuente de reglas: PR #48 SHA 6d5d9cc, adaptada al contrato de quiz-result-tests. */
const DIMS = [
  { k: 'est', n: 'Estrategia y valor' },
  { k: 'rol', n: 'Roles y decisiones' },
  { k: 'dat', n: 'Datos y privacidad' },
  { k: 'rie', n: 'Riesgo y control' },
  { k: 'seg', n: 'Seguridad y tecnología' },
  { k: 'per', n: 'Personas y cultura' }
];
const LEVELS = ['Inicial', 'En exploración', 'Definido', 'Gestionado'];
const ROUTES = ['Rápida', 'Estándar', 'Completa'];
const RISKS = ['Bajo', 'Medio', 'Alto'];
const TYPES = ['Cotidiano', 'En transición', 'Transformador'];
const AREAS = ['Atención a clientes', 'Marketing y contenido', 'Personal y reclutamiento', 'Finanzas y crédito', 'Operación interna', 'Otra área'];
const AREA_REG = [2, 2, 3, 3, 1, 1];
const AUT_SCALE = [0, 1, 3, 3, 4];
const AUT_RISK = [0, 1, 3, 2, 3];
const RM = [[0, 1, 2], [1, 1, 2], [1, 2, 2]];
const ROUTE_TXT = [
  'sugiere empezar por herramientas autorizadas, registro en el inventario y política de uso, sin sustituir la revisión de riesgos y controles del caso',
  'pide revisión del responsable de IA, checklist de riesgo, reglas de datos y pruebas básicas antes de lanzar',
  'pide aprobación de dirección, pruebas de seguridad, aprobación humana en decisiones clave y monitoreo continuo'
];
const WA_GENERIC = 'https://wa.me/522227097945?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20la%20autoevaluaci%C3%B3n%20de%20IA%20de%20%C3%93NIX.%20Aviso%20de%20privacidad%3A%20https%3A%2F%2Fwww.onix-ia.com%2Faviso-de-privacidad';
const PRIV = ' Aviso de privacidad: https://www.onix-ia.com/aviso-de-privacidad';

export const STEPS = [
  { p: 'm', d: 0, t: '¿El uso de IA está ligado a objetivos del negocio?', o: ['Cada quien la usa por su cuenta', 'Algunos usos tienen un objetivo claro', 'La mayoría tiene objetivo y responsable', 'Se priorizan y se miden contra resultados del negocio'] },
  { p: 'm', d: 0, t: '¿Miden el beneficio de lo que hacen con IA?', o: ['No lo medimos', 'Tenemos impresiones, sin números', 'Medimos algunos casos con una línea base', 'Cada caso tiene meta y se revisa periódicamente'] },
  { p: 'm', d: 1, t: '¿Hay alguien responsable del uso de IA en la empresa?', o: ['No hay un responsable', 'Alguien lo ve de forma informal', 'Hay una persona asignada', 'Hay un rol formal con objetivos y presupuesto'] },
  { p: 'm', d: 1, t: '¿Tienen una lista de las herramientas de IA que se usan y de quién las aprobó?', o: ['No sabemos bien cuáles se usan', 'Conocemos las principales', 'Hay una lista, pero no se actualiza', 'Hay un inventario actualizado con dueño por herramienta'] },
  { p: 'm', d: 2, t: '¿Tu equipo sabe qué información puede compartir con herramientas de IA?', o: ['No hay reglas', 'Hay recomendaciones de palabra', 'Hay reglas escritas', 'Hay reglas escritas y controles técnicos'] },
  { p: 'm', d: 2, t: '¿Tienen identificada su información sensible y un aviso de privacidad que contemple el uso de IA?', o: ['No', 'Sabemos cuál es, sin documentar', 'Está identificada; el aviso no menciona IA', 'Protegida, con reglas de acceso y aviso actualizado'] },
  { p: 'm', d: 3, t: '¿Revisan riesgos antes de adoptar una herramienta o lanzar un agente?', o: ['No, se adopta y ya', 'Solo en compras grandes', 'Hay una revisión básica', 'Hay checklist y aprobación según el nivel de riesgo'] },
  { p: 'm', d: 3, t: 'Si una IA le da una respuesta equivocada a un cliente, ¿qué pasa?', o: ['Probablemente no nos enteraríamos', 'Se corrige cuando alguien lo nota', 'Hay revisión humana en casos clave', 'Hay proceso de revisión, registro y mejora'] },
  { p: 'm', d: 4, t: '¿Las herramientas de IA se usan con cuentas empresariales y accesos controlados?', o: ['Cuentas personales, sin control', 'Mezcla de personales y empresariales', 'Principalmente empresariales', 'Todas empresariales, con accesos y registro de actividad'] },
  { p: 'm', d: 4, t: '¿Lo que construyen con IA se prueba antes de lanzarse y se monitorea después?', o: ['No se prueba ni se monitorea', 'Pruebas manuales de vez en cuando', 'Pruebas antes de lanzar, sin monitoreo', 'Pruebas automatizadas y monitoreo en operación'] },
  { p: 'm', d: 5, t: '¿Existe una política de uso aceptable de IA?', o: ['No', 'Se está hablando de hacerla', 'Existe, pero pocos la conocen', 'Existe, se comunica y se acepta formalmente'] },
  { p: 'm', d: 5, t: '¿Tu equipo ha recibido capacitación sobre uso responsable de IA?', o: ['Todavía no', 'Cada quien aprende por su cuenta', 'Hubo una sesión general', 'Capacitación por rol que se actualiza'] },
  { p: 'c', k: 'name', type: 'text', t: 'Piensa en tu caso de uso de IA más importante. ¿Cómo lo describirías?', h: 'Por ejemplo: asistente de WhatsApp para cotizaciones. Es opcional y no sale de tu navegador.' },
  { p: 'c', k: 'proc', t: '¿Qué tanto cambia la forma de trabajar?', o: ['Ayuda en una tarea; el proceso sigue igual', 'Se ajustan algunos pasos para aprovecharla', 'Se eliminan o cambian pasos y entregas', 'El proceso, los roles o el servicio se rediseñan'] },
  { p: 'c', k: 'aut', t: '¿Quién decide, la persona o la IA?', o: ['La IA sugiere; la persona decide y ejecuta', 'La revisión humana se vuelve superficial', 'La IA prepara acciones; la persona aprueba antes', 'La IA decide y actúa; la persona atiende excepciones'] },
  { p: 'c', k: 'pres', t: '¿Se usa cuando alguien la abre o trabaja sola?', o: ['Se activa cuando alguien la usa', 'Se usa a diario dentro de una aplicación', 'Reacciona a eventos u horarios y recuerda contexto', 'Monitorea y actúa de forma continua'] },
  { p: 'c', k: 'datos', t: '¿Qué tipo de información usa?', o: ['Pública o interna no confidencial', 'Confidencial del negocio', 'Datos personales, financieros u otros datos sensibles'] },
  { p: 'c', k: 'afect', t: '¿A quién afectan sus resultados?', o: ['Solo a empleados, uso interno', 'A proveedores o socios', 'A clientes o al público'] },
  { p: 'c', k: 'area', t: '¿En qué área se usa principalmente?', o: AREAS }
];

function entero(v, a, b) { return typeof v === 'number' && v === Math.floor(v) && v >= a && v <= b; }
function lvl(s) { if (!Number.isFinite(s)) return null; return s < 25 ? 1 : s < 50 ? 2 : s < 75 ? 3 : 4; }
function low(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

let lastMsg = '';

export function compute(a) {
  if (!a || !Array.isArray(a.d) || a.d.length !== 12) return null;
  for (let i = 0; i < 12; i++) if (!entero(a.d[i], 1, 4)) return null;
  if (!entero(a.proc, 1, 4) || !entero(a.aut, 1, 4) || !entero(a.pres, 1, 4)) return null;
  if (!entero(a.datos, 1, 3) || !entero(a.afect, 1, 3) || !entero(a.area, 0, 5)) return null;
  const dims = DIMS.map((D, i) => {
    const avg = (a.d[i * 2] + a.d[i * 2 + 1]) / 2;
    const s = Math.round((avg - 1) / 3 * 100);
    return { k: D.k, n: D.n, s, l: lvl(s), i };
  });
  if (dims.some((x) => !Number.isFinite(x.s) || !x.l)) return null;
  const gs = Math.round(dims.reduce((t, x) => t + x.s, 0) / dims.length);
  const minL = Math.min(...dims.map((x) => x.l));
  let gl = lvl(gs);
  let capped = false;
  if (!Number.isFinite(gs) || !gl) return null;
  if (gl > minL + 1) { gl = minL + 1; capped = true; }
  const escala = AUT_SCALE[a.aut];
  const P = [a.proc, escala, a.pres];
  const tipo = (P.indexOf(4) >= 0 || P.filter((v) => v >= 3).length >= 2) ? 2 : P.indexOf(3) >= 0 ? 1 : 0;
  const factors = [
    { n: 'Datos', v: a.datos },
    { n: 'Afectados', v: a.afect },
    { n: 'Autonomía', v: AUT_RISK[a.aut] },
    { n: 'Regulación', v: AREA_REG[a.area] }
  ];
  if (factors.some((f) => !entero(f.v, 1, 3))) return null;
  const risk = Math.max(...factors.map((f) => f.v));
  const highs = factors.filter((f) => f.v === 3).length;
  const route = RM[tipo][risk - 1];
  if (!Number.isFinite(route)) return null;
  const sorted = dims.slice().sort((x, y) => x.s - y.s || x.i - y.i);
  const empate = sorted[0].s === sorted[sorted.length - 1].s;
  const minS = sorted[0].s;
  const maxS = sorted[sorted.length - 1].s;
  const bajas = dims.filter((x) => x.s === minS);
  const altas = dims.filter((x) => x.s === maxS);
  const medio = empate
    ? 'las seis dimensiones empatan en ' + minS + ' de 100; no hay una fortaleza ni una brecha por encima de las demás'
    : (altas.length > 1 ? 'las fortalezas más altas empatan en ' + altas.map((x) => low(x.n)).join(', ') : 'tu mayor fortaleza está en ' + low(altas[0].n))
      + ' y ' + (bajas.length > 1 ? 'las brechas más grandes empatan en ' + bajas.map((x) => low(x.n)).join(', ') : 'tu principal brecha está en ' + low(bajas[0].n));
  const rutaNom = ROUTES[route];
  const cola = highs >= 2
    ? 'se clasifica de forma orientativa como un uso ' + low(TYPES[tipo]) + ' con riesgo estimado ' + low(RISKS[risk - 1]) + '. Hay más de un factor en riesgo alto: la ruta de gobierno ' + low(rutaNom) + ' es solo una referencia y no queda elegida.'
    : 'se clasifica de forma orientativa como un uso ' + low(TYPES[tipo]) + ' con riesgo estimado ' + low(RISKS[risk - 1]) + '; como punto de partida, sugerimos revisar la ruta de gobierno ' + low(rutaNom) + '.';
  const resumen = 'Con un índice de ' + gs + ' de 100, ' + medio + '. ' + cola;
  const cierre = empate
    ? 'Como las dimensiones empatan, la primera etapa no privilegia una sola.'
    : capped
      ? 'Tope aplicado: el nivel global queda en ' + LEVELS[gl - 1] + ' porque ' + dims.filter((x) => x.l === minL).map((x) => low(x.n)).join(', ') + ' está en ' + LEVELS[minL - 1] + '.'
      : 'Tu primera etapa debe atender ' + low(sorted[0].n) + ' y ' + low(sorted[1].n) + '.';
  const rutaFrase = highs >= 2
    ? 'La ruta ' + low(rutaNom) + ' aparece como referencia y no sustituye una revisión previa de este caso. No queda elegida.'
    : 'Para este caso, la ruta ' + low(rutaNom) + ' ' + ROUTE_TXT[route] + '.';
  const servicio = (route === 2 || ['rie', 'seg'].indexOf(sorted[0].k) >= 0) ? 'Revisión de riesgos de IA' : 'Ruta IA';
  const prioridades = empate ? 'las dimensiones empatan; no hay una brecha única' : sorted.slice(0, 3).map((x) => low(x.n)).join(', ');
  const rutaTxt = highs >= 2 ? 'la ruta ' + low(rutaNom) + ' es una referencia y no queda elegida' : 'ruta ' + low(rutaNom);
  const wa = 'Hola, hice la autoevaluación de IA de ÓNIX. Resultado orientativo según mis respuestas: nivel ' + LEVELS[gl - 1] + ' (índice ' + gs + ' de 100); caso de uso ' + low(TYPES[tipo]) + ' con riesgo estimado ' + low(RISKS[risk - 1]) + ', ' + rutaTxt + '. Prioridades: ' + prioridades + '. Me interesa ' + servicio + '.' + PRIV;
  lastMsg = wa;
  return {
    gs, level: LEVELS[gl - 1], route: rutaNom, tipo: TYPES[tipo], risk: RISKS[risk - 1],
    servicio, resumen, cierre, rutaFrase, wa, empate, capped, highs
  };
}

export function buildWhatsAppHref(r, incluir) {
  if (!incluir || !r || !r.wa || !Number.isFinite(r.gs) || String(r.wa).indexOf('NaN') !== -1) return WA_GENERIC;
  return 'https://wa.me/522227097945?text=' + encodeURIComponent(r.wa);
}

export function reset() { lastMsg = ''; }

export function lastWhatsApp() { return lastMsg; }
