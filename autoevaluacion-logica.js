/**
 * Autodiagnóstico de IA. Cálculo en el navegador, copiado de la especificación aprobada.
 * Decisiones pendientes (no son copy público):
 * 1. El enlace «Revisión de riesgos de IA» se deja como en el prototipo: /servicios/estrategia-de-ia#riesgos.
 * 2. «Evaluación completa» se muestra como en el prototipo (sin «próximamente»).
 * 3. No hay sección de leyes.
 * 4. La ficha documental sigue en /servicios/documentos-vivos.
 * 5. El clip 2 conserva «coinciden».
 */
export const D = ['Estrategia y valor', 'Roles y decisiones', 'Datos y privacidad', 'Riesgo y control', 'Seguridad y tecnología', 'Personas y cultura'];

export const QUESTIONS = [
  { dim: 'Estrategia y valor', t: '¿El uso de IA está ligado a objetivos del negocio?', opts: ['Cada quien la usa por su cuenta', 'Algunos usos tienen un objetivo claro', 'La mayoría tiene objetivo y responsable', 'Se priorizan y se miden contra resultados del negocio'] },
  { dim: 'Estrategia y valor', t: '¿Miden el beneficio de lo que hacen con IA?', opts: ['No lo medimos', 'Tenemos impresiones, sin números', 'Medimos algunos casos con una línea base', 'Cada caso tiene meta y se revisa periódicamente'] },
  { dim: 'Roles y decisiones', t: '¿Hay alguien responsable del uso de IA en la empresa?', opts: ['No hay un responsable', 'Alguien lo ve de forma informal', 'Hay una persona asignada', 'Hay un rol formal con objetivos y presupuesto'] },
  { dim: 'Roles y decisiones', t: '¿Tienen una lista de las herramientas de IA que se usan y de quién las aprobó?', opts: ['No sabemos bien cuáles se usan', 'Conocemos las principales', 'Hay una lista, pero no se actualiza', 'Hay un inventario actualizado con dueño por herramienta'] },
  { dim: 'Datos y privacidad', t: '¿Tu equipo sabe qué información puede compartir con herramientas de IA?', opts: ['No hay reglas', 'Hay recomendaciones de palabra', 'Hay reglas escritas', 'Hay reglas escritas y controles técnicos'] },
  { dim: 'Datos y privacidad', t: '¿Tienen identificada su información sensible y un aviso de privacidad que contemple el uso de IA?', opts: ['No', 'Sabemos cuál es, sin documentar', 'Está identificada; el aviso no menciona IA', 'Protegida, con reglas de acceso y aviso actualizado'] },
  { dim: 'Riesgo y control', t: '¿Revisan riesgos antes de adoptar una herramienta o lanzar un agente?', opts: ['No, se adopta y ya', 'Solo en compras grandes', 'Hay una revisión básica', 'Hay checklist y aprobación según el nivel de riesgo'] },
  { dim: 'Riesgo y control', t: 'Si una IA le da una respuesta equivocada a un cliente, ¿qué pasa?', opts: ['Probablemente no nos enteraríamos', 'Se corrige cuando alguien lo nota', 'Hay revisión humana en casos clave', 'Hay proceso de revisión, registro y mejora'] },
  { dim: 'Seguridad y tecnología', t: '¿Las herramientas de IA se usan con cuentas empresariales y accesos controlados?', opts: ['Cuentas personales, sin control', 'Mezcla de personales y empresariales', 'Principalmente empresariales', 'Todas empresariales, con accesos y registro de actividad'] },
  { dim: 'Seguridad y tecnología', t: '¿Lo que construyen con IA se prueba antes de lanzarse y se monitorea después?', opts: ['No se prueba ni se monitorea', 'Pruebas manuales de vez en cuando', 'Pruebas antes de lanzar, sin monitoreo', 'Pruebas automatizadas y monitoreo en operación'] },
  { dim: 'Personas y cultura', t: '¿Existe una política de uso aceptable de IA?', opts: ['No', 'Se está hablando de hacerla', 'Existe, pero pocos la conocen', 'Existe, se comunica y se acepta formalmente'] },
  { dim: 'Personas y cultura', t: '¿Tu equipo ha recibido capacitación sobre uso responsable de IA?', opts: ['Todavía no', 'Cada quien aprende por su cuenta', 'Hubo una sesión general', 'Capacitación por rol que se actualiza'] },
  { dim: 'Caso de uso principal', t: '¿Cómo lo describirías?', text: true },
  { dim: 'Caso de uso principal', t: '¿Qué tanto cambia la forma de trabajar?', opts: ['Ayuda en una tarea; el proceso sigue igual', 'Se ajustan algunos pasos para aprovecharla', 'Se eliminan o cambian pasos y entregas', 'El proceso, los roles o el servicio se rediseñan'] },
  { dim: 'Caso de uso principal', t: '¿Quién decide, la persona o la IA?', opts: ['La IA sugiere; la persona decide y ejecuta', 'La revisión humana se vuelve superficial', 'La IA prepara acciones; la persona aprueba antes', 'La IA decide y actúa; la persona atiende excepciones'] },
  { dim: 'Caso de uso principal', t: '¿Se usa cuando alguien la abre o trabaja sola?', opts: ['Se activa cuando alguien la usa', 'Se usa a diario dentro de una aplicación', 'Reacciona a eventos u horarios y recuerda contexto', 'Monitorea y actúa de forma continua'] },
  { dim: 'Caso de uso principal', t: '¿Qué tipo de información usa?', opts: ['Pública o interna no confidencial', 'Confidencial del negocio', 'Datos personales, financieros u otros datos sensibles'] },
  { dim: 'Caso de uso principal', t: '¿A quién afectan sus resultados?', opts: ['Solo a empleados, uso interno', 'A proveedores o socios', 'A clientes o al público'] },
  { dim: 'Caso de uso principal', t: '¿En qué área se usa principalmente?', opts: ['Atención a clientes', 'Marketing y contenido', 'Personal y reclutamiento', 'Finanzas y crédito', 'Operación interna', 'Otra área'] }
];

export function preset(name) {
  if (name === 'resultado con tope') return [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, '', 1, 1, 1, 1, 1, 4];
  if (name === 'resultado empate total') return [2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, '', 2, 3, 2, 2, 2, 1];
  if (name === 'resultado dos factores altos') return [3, 3, 2, 3, 1, 2, 2, 2, 3, 4, 2, 2, '', 3, 2, 2, 3, 3, 3];
  if (name === 'respuestas incompletas') return [3, 3, 2, null, 1, 2, 2, 2, 3, 4, 2, 2, '', 3, 2, 2, 3, 3, 3];
  return null;
}

const ok = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function compute(a) {
  for (let i = 0; i < 12; i++) if (!ok(a[i], 1, 4)) return null;
  const proc = a[13], aut = a[14], pres = a[15], datos = a[16], afect = a[17], area = a[18];
  if (!ok(proc, 1, 4) || !ok(aut, 1, 4) || !ok(pres, 1, 4) || !ok(datos, 1, 3) || !ok(afect, 1, 3) || !ok(area, 0, 5)) return null;
  const LV = ['Inicial', 'En exploración', 'Definido', 'Gestionado'];
  const lvl = (s) => s >= 75 ? 3 : s >= 50 ? 2 : s >= 25 ? 1 : 0;
  const sc = D.map((n, k) => Math.round(((a[2 * k] + a[2 * k + 1]) / 2 - 1) / 3 * 100));
  const index = Math.round(sc.reduce((x, y) => x + y, 0) / 6);
  if (!isFinite(index)) return null;
  const minS = Math.min.apply(null, sc), maxS = Math.max.apply(null, sc);
  const minL = lvl(minS);
  const raw = lvl(index);
  const cap = Math.min(raw, minL + 1);
  const capped = cap < raw;
  const allTie = minS === maxS;
  const order = sc.map((s, k) => ({ s: s, k: k })).sort((x, y) => (x.s - y.s) || (x.k - y.k));
  const low3 = order.slice(0, 3).map((o) => o.k);
  const tops = D.filter((n, k) => sc[k] === maxS), bots = D.filter((n, k) => sc[k] === minS);
  const layers = [['Gobierno', [0, 1, 5]], ['Riesgo', [2, 3]], ['Seguridad', [4]]].map((l) => ({ n: l[0], s: Math.round(l[1].reduce((x, k) => x + sc[k], 0) / l[1].length) }));
  const autT = [1, 3, 3, 4][aut - 1];
  const tv = [proc, autT, pres];
  const tipo = (tv.indexOf(4) >= 0 || tv.filter((v) => v >= 3).length >= 2) ? 2 : (tv.indexOf(3) >= 0 ? 1 : 0);
  const autR = [1, 3, 2, 3][aut - 1];
  const reg = [2, 2, 3, 3, 1, 1][area];
  const f = [datos, afect, autR, reg];
  const risk = Math.max.apply(null, f);
  const highs = f.filter((v) => v === 3).length;
  const M = [['Rápida', 'Estándar', 'Completa'], ['Estándar', 'Estándar', 'Completa'], ['Estándar', 'Completa', 'Completa']];
  const ruta = M[tipo][risk - 1];
  const lowestDim = order[0].k;
  const svcRisk = ruta === 'Completa' || lowestDim === 3 || lowestDim === 4;
  return { f: f, proc: proc, aut: aut, pres: pres, tipoIdx: tipo, riskIdx: risk - 1, M: M, D: D, sc: sc, index: index, level: LV[cap], levelIdx: cap, capped: capped, rawLevel: LV[raw], allTie: allTie, low3: low3, order: order, tops: tops, bots: bots, layers: layers, tipo: ['Cotidiano', 'En transición', 'Transformador'][tipo], risk: ['Bajo', 'Medio', 'Alto'][risk - 1], highs: highs, ruta: ruta, noElegida: highs >= 2, svcRisk: svcRisk, LV: LV, lvl: lvl, minS: minS, nombre: (a[12] || '').trim() };
}

export function reportOf(R) {
  const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const join = (a) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  let summary = 'Con un índice de ' + R.index + ' de 100, ';
  if (R.allTie) summary += 'las seis dimensiones empatan en ' + R.minS + ' de 100; no hay una fortaleza ni una brecha por encima de las demás.';
  else summary += (R.tops.length > 1 ? 'empatan como fortalezas ' + join(R.tops) : 'tu fortaleza está en ' + R.tops[0]) + ' y ' + (R.bots.length > 1 ? 'empatan como brechas ' + join(R.bots) : 'tu brecha principal está en ' + R.bots[0]) + '.';
  summary += ' Tu caso de uso principal se clasifica de forma orientativa como un uso ' + low(R.tipo) + ' con riesgo estimado ' + low(R.risk) + '.';
  summary += R.noElegida ? ' La ruta de gobierno ' + R.ruta + ' es solo una referencia y no queda elegida.' : ' Como punto de partida, sugerimos revisar la ruta de gobierno ' + R.ruta + '.';
  const RT = { 'Rápida': 'sugiere empezar por herramientas autorizadas, registro en el inventario y política de uso, sin sustituir la revisión de riesgos y controles del caso', 'Estándar': 'pide revisión del responsable de IA, checklist de riesgo, reglas de datos y pruebas básicas antes de lanzar', 'Completa': 'pide aprobación de dirección, pruebas de seguridad, aprobación humana en decisiones clave y monitoreo continuo' };
  const RD = { 'Rápida': 'Lista básica de revisión y una persona responsable. Antes de lanzar, confirma qué riesgos y controles aplican a tu caso; esta ruta es orientativa.', 'Estándar': 'Checklist de riesgo, pruebas antes de operar y aprobación humana en los puntos clave.', 'Completa': 'Revisión de riesgo a fondo antes de lanzar: pruebas con casos reales, monitoreo y un plan de respuesta si algo falla.' };
  const minLay = Math.min.apply(null, R.layers.map((l) => l.s));
  const lowLay = R.layers.filter((l) => l.s === minLay).map((l) => l.n + ' (' + l.s + ' de 100)');
  const b1 = R.allTie ? 'Las capas también se leen en conjunto: ninguna queda como la única brecha por este empate.' : (lowLay.length > 1 ? 'Capas con menor puntaje, empatadas: ' + join(lowLay) + '.' : 'Capa con menor puntaje: ' + lowLay[0] + '.');
  const b2 = R.noElegida ? 'La ruta ' + R.ruta + ' es solo una referencia y no queda elegida.' : 'La ruta ' + R.ruta + ' ' + RT[R.ruta] + '.';
  const minDimName = R.D[R.order[0].k];
  const b3 = R.allTie ? 'Como las dimensiones empatan, la primera etapa no privilegia una sola.' : (R.capped ? 'Tu nivel global se limitó a ' + R.level + ' por tu dimensión más baja: ' + minDimName + '. El índice no cambia.' : 'Tu primera etapa debe atender ' + R.D[R.order[0].k] + ' y ' + R.D[R.order[1].k] + '.');
  const PT = [
    ['Liga cada uso de IA a un beneficio medible.', 'Para cada caso de uso, define el beneficio esperado (tiempo ahorrado, errores evitados, ingresos o satisfacción del cliente), su línea base y quién responde por el resultado.', 'Línea base.', 'Es el valor del indicador hoy, antes de usar IA: por ejemplo, cuánto tarda una cotización o cuántos errores de captura hay en un periodo. Sin ella no puedes demostrar si la IA mejoró algo.', ['Elige un indicador por caso de uso y mide su valor actual.', 'Fija una meta y una fecha de revisión.', 'Asigna una persona dueña del resultado y compara contra la línea base en cada revisión.']],
    ['Define principios de IA y un inventario de herramientas autorizadas.', 'Acuerden los principios de responsabilidad y ética que guían el uso de IA (transparencia, supervisión humana, privacidad y trato justo) y quién decide sobre IA en la empresa.', 'Inventario de herramientas.', 'Lista de las herramientas y agentes de IA autorizados y permitidos por la organización: para qué se usa cada uno, con qué cuenta, qué datos puede usar y quién es su dueño.', ['Publica los principios y nombra a un responsable o comité de IA.', 'Levanta el inventario de lo que ya se usa, incluido lo que cada persona usa por su cuenta.', 'Clasifica cada herramienta: autorizada, permitida con restricciones o no permitida.']],
    ['Establece políticas de datos para IA.', 'Las políticas de datos dicen qué información puede usarse en cada herramienta de IA y bajo qué condiciones, incluidos los datos personales y financieros.', 'Clasificación de la información.', 'Pública, interna, confidencial y sensible. Cada nivel se relaciona con las herramientas autorizadas que lo pueden procesar y con los controles que necesita.', ['Clasifica tu información por nivel de sensibilidad.', 'Define qué nivel puede usar cada herramienta autorizada.', 'Actualiza tu aviso de privacidad para contemplar el uso de IA y comunica las reglas al equipo.']],
    ['Revisa riesgos antes de lanzar.', 'Evalúa los riesgos de cada caso de uso con referencias pertinentes: ISO/IEC 42001 para la gestión de IA y, cuando uses modelos de lenguaje, las guías de OWASP para sus aplicaciones. Define medidas para reducir los riesgos identificados y supervisión humana en decisiones que afectan información sensible, la operación o a clientes.', '', '', ['Lista los riesgos de cada caso con el marco elegido.', 'Clasifica cada decisión por impacto, como en la tabla, y asigna su nivel de supervisión humana.', 'Define el mecanismo que mitiga cada riesgo y quién lo revisa.']],
    ['Controla accesos, prueba y monitorea.', 'Usa cuentas empresariales con permisos mínimos, prueba cada solución antes de operar y monitorea su desempeño, costos e incidentes después del lanzamiento.', 'Pruebas antes de operar.', 'Casos reales y casos de ataque: respuestas incorrectas, fugas de información e instrucciones maliciosas escondidas en lo que recibe la IA (prompt injection).', ['Cuentas empresariales con acceso de mínimo permiso.', 'Pruebas con casos reales y casos de ataque antes de lanzar.', 'Registro de actividad y alertas en operación.']],
    ['Publica una política de uso de IA y capacita.', 'La política de uso de IA dice qué se puede hacer, con qué herramientas, con qué datos y qué no está permitido. Debe ser corta, conocida por todos y aceptada formalmente.', 'Capacitación por rol.', 'Dirección, quienes usan IA en su día a día y quienes la construyen necesitan saber cosas distintas; cada grupo recibe lo que le toca aplicar.', ['Redacta la política en lenguaje claro y pide aceptación formal.', 'Capacita por rol.', 'Revisa la política cuando cambien herramientas, datos o regulación.']]
  ];
  const IMP = [['Impacto bajo', 'Uso interno con información pública o interna no confidencial. Define controles y supervisión según el caso; registra las acciones de la IA.'], ['Impacto medio', 'Afecta la operación o usa información confidencial. La IA propone y una persona aprueba antes de ejecutar.'], ['Impacto alto', 'Usa datos sensibles o afecta a clientes. Una persona decide, con registro, opción de revertir y forma de pausar la IA.']];
  const pri = R.allTie ? [] : R.low3.map((k) => ({ dim: R.D[k] + ' · ' + R.sc[k] + ' de 100', h: PT[k][0], p: PT[k][1], dt: PT[k][2], dd: PT[k][3], hasImp: k === 3, imp: k === 3 ? IMP : [], steps: PT[k][4] }));
  const nombre = R.nombre;
  const st1 = ['Principios de responsabilidad y ética de IA', 'Inventario de herramientas y agentes autorizados', 'Políticas de datos', 'Política de uso de IA'];
  if (R.ruta === 'Completa') st1.unshift(nombre ? 'Revisión de riesgo de “' + nombre + '”' : 'Revisión de riesgo de tu caso principal');
  const plan = [
    { t: 'Etapa 1 · Bases', s: 'Para empezar.', items: st1 },
    { t: 'Etapa 2 · Controles', s: 'Cuando las bases estén listas.', items: ['Evaluación de riesgos con un marco para LLM', 'Pruebas antes de operar', 'Supervisión humana (HITL) según el impacto', 'Metas y métricas de valor por caso'] },
    { t: 'Etapa 3 · Mejora continua', s: 'Para sostenerlo.', items: ['Monitoreo en operación', 'Reevaluación ante cambios de modelo o datos', 'Capacitación por rol', 'Revisión periódica de política y valor'] }
  ];
  const prio = R.allTie ? 'las dimensiones empatan; no hay una brecha única' : R.low3.map((k) => R.D[k]).join(', ');
  const rutaTxt = R.noElegida ? 'la ruta ' + R.ruta + ' es una referencia y no queda elegida' : 'ruta ' + R.ruta;
  const msg = 'Hola, hice el autodiagnóstico de IA de ÓNIX. Resultado orientativo según mis respuestas: nivel ' + R.level + ' (índice ' + R.index + ' de 100); caso de uso ' + low(R.tipo) + ' con riesgo estimado ' + low(R.risk) + ', ' + rutaTxt + '. Prioridades: ' + prio + '. Me interesa ' + (R.svcRisk ? 'Revisión de riesgos de IA' : 'Ruta IA') + '. Aviso de privacidad: https://www.onix-ia.com/aviso-de-privacidad';
  return { summary, bullets: [b1, b2, b3], RD, pri, plan, msg, svc: R.svcRisk ? 'Revisión de riesgos de IA' : 'Ruta IA', svcHref: R.svcRisk ? '/servicios/estrategia-de-ia#riesgos' : '/servicios/estrategia-de-ia' };
}
