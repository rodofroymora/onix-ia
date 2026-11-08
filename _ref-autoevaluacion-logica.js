/* Lógica de la autoevaluación (sin DOM).
   La cargan autoevaluacion.js y scripts/tests/autoevaluacion.test.js.
   Los 6 checks de release solo leen HTML: este archivo no entra en esa cobertura. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AE_LOGICA = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SERVICIO_RUTA = 'Ruta IA';
  var SERVICIO_RIESGOS = 'Revisión de riesgos de IA';
  var DIMS = [
    { k: 'est', n: 'Estrategia y valor', capa: 'Gobierno', l: ['Estrategia', 'y valor'] },
    { k: 'rol', n: 'Roles y decisiones', capa: 'Gobierno', l: ['Roles y', 'decisiones'] },
    { k: 'dat', n: 'Datos y privacidad', capa: 'Riesgo', l: ['Datos y', 'privacidad'] },
    { k: 'rie', n: 'Riesgo y control', capa: 'Riesgo', l: ['Riesgo y', 'control'] },
    { k: 'seg', n: 'Seguridad y tecnología', capa: 'Seguridad', l: ['Seguridad y', 'tecnología'] },
    { k: 'per', n: 'Personas y cultura', capa: 'Gobierno', l: ['Personas y', 'cultura'] }
  ];
  var LEVELS = ['Inicial', 'En exploración', 'Definido', 'Gestionado'];
  var ROUTES = ['Rápida', 'Estándar', 'Completa'];
  var RISKS = ['Bajo', 'Medio', 'Alto'];
  var TYPES = ['Cotidiano', 'En transición', 'Transformador'];
  var AREAS = ['Atención a clientes', 'Marketing y contenido', 'Personal y reclutamiento', 'Finanzas y crédito', 'Operación interna', 'Otra área'];
  var AREA_REG = [2, 2, 3, 3, 1, 1];
  /* Escala de autonomía (tipo de caso y perfil) separada del riesgo por supervisión.
     La revisión superficial no es un peldaño más bajo que la aprobación efectiva:
     las dos describen una compuerta humana; la escala es la misma (3). */
  var AUT_SCALE = [0, 1, 3, 3, 4];
  /* Riesgo del factor Autonomía. La revisión superficial es alto; aprobar antes es medio. */
  var AUT_RISK = [0, 1, 3, 2, 3];

  var STEPS = [
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

  var RECS = {
    est: { t: 'Liga cada uso de IA a un beneficio medible', s: SERVICIO_RUTA,
      w: 'Para cada caso de uso, define el beneficio esperado (tiempo ahorrado, errores evitados, ingresos o satisfacción del cliente), su línea base y quién responde por el resultado.',
      def: ['Línea base', 'Es el valor del indicador hoy, antes de usar IA: por ejemplo, cuánto tarda una cotización o cuántos errores de captura hay en un periodo. Sin ella no puedes demostrar si la IA mejoró algo.'],
      a: ['Elige un indicador por caso de uso y mide su valor actual.', 'Fija una meta y una fecha de revisión.', 'Asigna una persona dueña del resultado y compara contra la línea base en cada revisión.'] },
    rol: { t: 'Define principios de IA y un inventario de herramientas autorizadas', s: SERVICIO_RUTA,
      w: 'Acuerden los principios de responsabilidad y ética que guían el uso de IA (transparencia, supervisión humana, privacidad y trato justo) y quién decide sobre IA en la empresa.',
      def: ['Inventario de herramientas', 'Lista de las herramientas y agentes de IA autorizados y permitidos por la organización: para qué se usa cada uno, con qué cuenta, qué datos puede usar y quién es su dueño.'],
      a: ['Publica los principios y nombra a un responsable o comité de IA.', 'Levanta el inventario de lo que ya se usa, incluido lo que cada persona usa por su cuenta.', 'Clasifica cada herramienta: autorizada, permitida con restricciones o no permitida.'] },
    dat: { t: 'Establece políticas de datos para IA', s: SERVICIO_RUTA,
      w: 'Las políticas de datos dicen qué información puede usarse en cada herramienta de IA y bajo qué condiciones, incluidos los datos personales y financieros.',
      def: ['Clasificación de la información', 'Pública, interna, confidencial y sensible. Cada nivel se relaciona con las herramientas autorizadas que lo pueden procesar y con los controles que necesita.'],
      a: ['Clasifica tu información por nivel de sensibilidad.', 'Define qué nivel puede usar cada herramienta autorizada.', 'Actualiza tu aviso de privacidad para contemplar el uso de IA y comunica las reglas al equipo.'] },
    rie: { t: 'Revisa riesgos antes de lanzar', s: SERVICIO_RIESGOS,
      w: 'Evalúa los riesgos de cada caso de uso con referencias pertinentes: ISO/IEC 42001 para la gestión de IA y, cuando uses modelos de lenguaje, las guías de OWASP para sus aplicaciones. Define medidas para reducir los riesgos identificados y supervisión humana en decisiones que afectan información sensible, la operación o a clientes.',
      lv: [['c-ok', 'Impacto bajo', 'Uso interno con información pública o interna no confidencial. Define controles y supervisión según el caso; registra las acciones de la IA.'], ['c-rev', 'Impacto medio', 'Afecta la operación o usa información confidencial. La IA propone y una persona aprueba antes de ejecutar.'], ['c-alto', 'Impacto alto', 'Usa datos sensibles o afecta a clientes. Una persona decide, con registro, opción de revertir y forma de pausar la IA.']],
      a: ['Lista los riesgos de cada caso con el marco elegido.', 'Clasifica cada decisión por impacto, como en la tabla, y asigna su nivel de supervisión humana.', 'Define el mecanismo que mitiga cada riesgo y quién lo revisa.'] },
    seg: { t: 'Controla accesos, prueba y monitorea', s: SERVICIO_RIESGOS,
      w: 'Usa cuentas empresariales con permisos mínimos, prueba cada solución antes de operar y monitorea su desempeño, costos e incidentes después del lanzamiento.',
      def: ['Pruebas antes de operar', 'Casos reales y casos de ataque: respuestas incorrectas, fugas de información e instrucciones maliciosas escondidas en lo que recibe la IA (prompt injection).'],
      a: ['Cuentas empresariales con acceso de mínimo permiso.', 'Pruebas con casos reales y casos de ataque antes de lanzar.', 'Registro de actividad y alertas en operación.'] },
    per: { t: 'Publica una política de uso de IA y capacita', s: SERVICIO_RUTA,
      w: 'La política de uso de IA dice qué se puede hacer, con qué herramientas, con qué datos y qué no está permitido. Debe ser corta, conocida por todos y aceptada formalmente.',
      def: ['Capacitación por rol', 'Dirección, quienes usan IA en su día a día y quienes la construyen necesitan saber cosas distintas; cada grupo recibe lo que le toca aplicar.'],
      a: ['Redacta la política en lenguaje claro y pide aceptación formal.', 'Capacita por rol.', 'Revisa la política cuando cambien herramientas, datos o regulación.'] }
  };
  var SVC_URL = {};
  SVC_URL[SERVICIO_RUTA] = '/servicios/estrategia-de-ia';
  SVC_URL[SERVICIO_RIESGOS] = '/servicios/auditoria-de-ia';
  var ROUTE_INFO = [
    'Lista básica de revisión y una persona responsable. Antes de lanzar, confirma qué riesgos y controles aplican a tu caso; esta ruta es orientativa.',
    'Checklist de riesgo, pruebas antes de operar y aprobación humana en los puntos clave.',
    'Revisión de riesgo a fondo antes de lanzar: pruebas con casos reales, monitoreo y un plan de respuesta si algo falla.'
  ];
  var ROUTE_TXT = [
    'sugiere empezar por herramientas autorizadas, registro en el inventario y política de uso, sin sustituir la revisión de riesgos y controles del caso',
    'pide revisión del responsable de IA, checklist de riesgo, reglas de datos y pruebas básicas antes de lanzar',
    'pide aprobación de dirección, pruebas de seguridad, aprobación humana en decisiones clave y monitoreo continuo'
  ];
  var WAVES = [
    { n: 'Etapa 1 · Bases', t: 'Bases', hz: 'Para empezar', a: [['Principios de responsabilidad y ética de IA', 'rol'], ['Inventario de herramientas y agentes autorizados', 'rol'], ['Políticas de datos', 'dat'], ['Política de uso de IA', 'per']] },
    { n: 'Etapa 2 · Controles', t: 'Controles', hz: 'Cuando las bases estén listas', a: [['Evaluación de riesgos con un marco para LLM', 'rie'], ['Pruebas antes de operar', 'seg'], ['Supervisión humana (HITL) según el impacto', 'rie'], ['Metas y métricas de valor por caso', 'est']] },
    { n: 'Etapa 3 · Mejora continua', t: 'Mejora continua', hz: 'Para sostenerlo', a: [['Monitoreo en operación', 'seg'], ['Reevaluación ante cambios de modelo o datos', 'rie'], ['Capacitación por rol', 'per'], ['Revisión periódica de política y valor', 'est']] }
  ];
  var LAW_BASE = { n: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares', w: 'Aviso de privacidad y derechos de las personas frente a decisiones automatizadas.' };
  var LAWS = [
    [{ n: 'Ley Federal de Protección al Consumidor', w: 'Información veraz al cliente; conviene avisar cuando interactúa con IA.' }],
    [{ n: 'Ley Federal de Protección al Consumidor', w: 'Publicidad y contenido que no engañen, también si los genera la IA.' }, { n: 'Ley Federal del Derecho de Autor', w: 'Uso de obras de terceros y titularidad del contenido generado.' }],
    [{ n: 'Ley Federal del Trabajo', w: 'Uso de IA en reclutamiento, evaluación o monitoreo de personal.' }, { n: 'Ley Federal para Prevenir y Eliminar la Discriminación', w: 'Pruebas de sesgo cuando la IA influye en decisiones sobre personas.' }],
    [{ n: 'Ley para Regular las Instituciones de Tecnología Financiera y Ley de Instituciones de Crédito', w: 'Decisiones de crédito y gestión de riesgo tecnológico.' }, { n: 'Ley de Protección y Defensa al Usuario de Servicios Financieros', w: 'Trato y atención a usuarios financieros, también por canales automatizados.' }],
    [{ n: 'Ley Federal de Protección a la Propiedad Industrial', w: 'Protege tus secretos industriales al usar herramientas externas.' }],
    []
  ];
  var SAMPLE = { m: [2, 1, 2, 1, 2, 2, 1, 2, 3, 1, 1, 2], name: 'Asistente de WhatsApp para cotizaciones', proc: 2, aut: 3, pres: 2, datos: 2, afect: 3, area: 0, org: 'Empresa Ejemplo', sample: true };
  var WA_BASE = 'https://wa.me/522227097945?text=';
  var PRIV = ' Aviso de privacidad: https://www.onix-ia.com/aviso-de-privacidad';
  var ETIQUETA_RIESGO = 'Riesgo estimado';
  var KICKER = 'Una opción para conversar: ';
  var MOTIVO_ACOMP = 'Según tus respuestas, puede convenirte acompañamiento para preparar los siguientes pasos; confirmamos el alcance contigo.';
  var MOTIVO_EVAL = 'La evaluación completa permite contrastar tus respuestas con evidencia y precisar los siguientes pasos.';
  var RM = [[0, 1, 2], [1, 1, 2], [1, 2, 2]];
  var RC = ['c-ok', 'c-rev', 'c-alto'];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lvl(s) {
    if (!Number.isFinite(s)) return null;
    return s < 25 ? 1 : s < 50 ? 2 : s < 75 ? 3 : 4;
  }
  function low(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function entero(v, a, b) { return typeof v === 'number' && v === Math.floor(v) && v >= a && v <= b; }
  function autScale(aut) { return AUT_SCALE[aut] || null; }
  function autRisk(aut) { return AUT_RISK[aut] || null; }

  function entradasValidas(d) {
    if (!d || !Array.isArray(d.m) || d.m.length !== 12) return false;
    for (var i = 0; i < 12; i++) if (!entero(d.m[i], 1, 4)) return false;
    if (!entero(d.proc, 1, 4) || !entero(d.aut, 1, 4) || !entero(d.pres, 1, 4)) return false;
    if (!entero(d.datos, 1, 3) || !entero(d.afect, 1, 3)) return false;
    if (!entero(d.area, 0, 5)) return false;
    if (!autScale(d.aut) || !autRisk(d.aut)) return false;
    return true;
  }

  function compute(d) {
    if (!entradasValidas(d)) return null;
    var dims = DIMS.map(function (D, i) {
      var a = (d.m[i * 2] + d.m[i * 2 + 1]) / 2;
      var s = Math.round((a - 1) / 3 * 100);
      var l = lvl(s);
      return Object.assign({}, D, { s: s, l: l, i: i });
    });
    if (dims.some(function (x) { return !Number.isFinite(x.s) || !x.l; })) return null;
    var gs = Math.round(dims.reduce(function (t, x) { return t + x.s; }, 0) / dims.length);
    var minL = Math.min.apply(null, dims.map(function (x) { return x.l; }));
    var gl = lvl(gs), capped = false;
    if (!Number.isFinite(gs) || !gl) return null;
    if (gl > minL + 1) { gl = minL + 1; capped = true; }
    var capas = ['Gobierno', 'Riesgo', 'Seguridad'].map(function (c) {
      var ds = dims.filter(function (x) { return x.capa === c; });
      return { n: c, ds: ds, s: Math.round(ds.reduce(function (t, x) { return t + x.s; }, 0) / ds.length) };
    });
    var escala = autScale(d.aut);
    var P = [d.proc, escala, d.pres];
    var tipo = (P.indexOf(4) >= 0 || P.filter(function (v) { return v >= 3; }).length >= 2) ? 2 : P.indexOf(3) >= 0 ? 1 : 0;
    var factors = [{ n: 'Datos', v: d.datos }, { n: 'Afectados', v: d.afect }, { n: 'Autonomía', v: autRisk(d.aut) }, { n: 'Regulación', v: AREA_REG[d.area] }];
    if (factors.some(function (f) { return !entero(f.v, 1, 3); })) return null;
    var risk = Math.max.apply(null, factors.map(function (f) { return f.v; }));
    var highs = factors.filter(function (f) { return f.v === 3; }).length;
    var sorted = dims.slice().sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    var route = RM[tipo][risk - 1];
    if (!Number.isFinite(route)) return null;
    return { dims: dims, gs: gs, gl: gl, capped: capped, minL: minL, capas: capas, tipo: tipo, risk: risk, highs: highs, factors: factors, route: route, weak: sorted.slice(0, 3), strong: sorted[sorted.length - 1], escalaAut: escala, empate: sorted[0].s === sorted[sorted.length - 1].s };
  }

  function nextService(r) {
    return r.route === 2 || ['rie', 'seg'].indexOf(r.weak[0].k) >= 0 ? SERVICIO_RIESGOS : SERVICIO_RUTA;
  }

  /* La política de cuándo sugerir Acompañamiento no se cambia aquí: sigue el criterio ya publicado.
     El texto no atribuye esa sugerencia al riesgo del caso. */
  function tierRecomendada(r) {
    return (r.gl === 1 || r.highs >= 2 || (r.route === 2 && r.gl <= 2)) ? 2 : 1;
  }
  function motivoTier(pick) { return pick === 2 ? MOTIVO_ACOMP : MOTIVO_EVAL; }
  function tituloReporte(nivel) { return 'Según tus respuestas, tu nivel orientativo de preparación para IA es ' + nivel; }
  function comportamientoScroll(reduce) { return reduce ? 'auto' : 'smooth'; }

  function listaNombres(arr) {
    return arr.map(function (x) { return low(x.n); }).join(', ');
  }
  function htmlResumen(caseNameHtml, r) {
    var tipo = esc(low(TYPES[r.tipo]));
    var riesgo = esc(low(RISKS[r.risk - 1]));
    var ruta = esc(low(ROUTES[r.route]));
    var minS = r.weak[0].s;
    var maxS = r.strong.s;
    var bajas = r.dims.filter(function (x) { return x.s === minS; });
    var altas = r.dims.filter(function (x) { return x.s === maxS; });
    var medio;
    if (minS === maxS) {
      medio = 'las seis dimensiones empatan en ' + minS + ' de 100; no hay una fortaleza ni una brecha por encima de las demás';
    } else {
      var fort = altas.length > 1 ? 'las fortalezas más altas empatan en ' + esc(listaNombres(altas)) : 'tu mayor fortaleza está en ' + esc(listaNombres(altas));
      var bre = bajas.length > 1 ? 'las brechas más grandes empatan en ' + esc(listaNombres(bajas)) : 'tu principal brecha está en ' + esc(listaNombres(bajas));
      medio = fort + ' y ' + bre;
    }
    var cola = r.highs >= 2
      ? caseNameHtml + ' se clasifica de forma orientativa como un uso <em>' + tipo + '</em> con riesgo estimado <em>' + riesgo + '</em>. Hay más de un factor en riesgo alto: la ruta de gobierno <em>' + ruta + '</em> es solo una referencia y no queda elegida.'
      : caseNameHtml + ' se clasifica de forma orientativa como un uso <em>' + tipo + '</em> con riesgo estimado <em>' + riesgo + '</em>; como punto de partida, sugerimos revisar la ruta de gobierno <em>' + ruta + '</em>.';
    return 'Con un índice de <em>' + r.gs + ' de 100</em>, ' + medio + '. ' + cola;
  }
  function vinietas(r) {
    var weakCapa = r.capas.slice().sort(function (a, b) { return a.s - b.s; })[0];
    var ruta = r.highs >= 2
      ? 'La ruta ' + low(ROUTES[r.route]) + ' aparece como referencia y no sustituye una revisión previa de este caso.'
      : 'Para este caso, la ruta ' + low(ROUTES[r.route]) + ' ' + ROUTE_TXT[r.route] + '.';
    var cierre = r.empate
      ? 'Como las dimensiones empatan, la primera etapa no privilegia una sola.'
      : r.capped
        ? 'El nivel global se limitó a ' + LEVELS[r.gl - 1] + ' porque una dimensión está en nivel ' + LEVELS[r.minL - 1] + '.'
        : 'Tu primera etapa debe atender ' + low(r.weak[0].n) + ' y ' + low(r.weak[1].n) + '.';
    var capa = r.empate
      ? 'Las capas también se leen en conjunto: ninguna queda como la única brecha por este empate.'
      : 'Tu capa más débil es ' + low(weakCapa.n) + ' (' + weakCapa.s + ' de 100).';
    return [capa, ruta, cierre];
  }
  function textoTope(r) {
    if (!r.capped) return '';
    var enMin = r.dims.filter(function (x) { return x.l === r.minL; });
    var quien = enMin.map(function (x) { return low(x.n); }).join(', ');
    return 'Tope aplicado: el índice cae en ' + LEVELS[lvl(r.gs) - 1] + ', pero el nivel global queda en ' + LEVELS[r.gl - 1] + ' porque ' + quien + (enMin.length > 1 ? ' están' : ' está') + ' en ' + LEVELS[r.minL - 1] + '.';
  }
  function mensajeWhatsapp(r, svc) {
    if (!r || !Number.isFinite(r.gs) || !Number.isFinite(r.gl) || !Number.isFinite(r.route)) return '';
    var rutaTxt = r.highs >= 2
      ? 'la ruta ' + low(ROUTES[r.route]) + ' es una referencia y no queda elegida'
      : 'ruta ' + low(ROUTES[r.route]);
    var prioridades = r.empate
      ? 'las dimensiones empatan; no hay una brecha única'
      : r.weak.map(function (x) { return low(x.n); }).join(', ');
    return 'Hola, hice la autoevaluación de IA de ÓNIX. Resultado orientativo según mis respuestas: nivel ' + LEVELS[r.gl - 1] + ' (índice ' + r.gs + ' de 100); caso de uso ' + low(TYPES[r.tipo]) + ' con riesgo estimado ' + low(RISKS[r.risk - 1]) + ', ' + rutaTxt + '. Prioridades: ' + prioridades + '. Me interesa ' + svc + '.' + PRIV;
  }
  function hrefWhatsapp(o) {
    var base = o && o.base ? o.base : '';
    if (!o || !o.incluir || o.sample || o.stale || !o.msg || !Number.isFinite(o.gs)) return base;
    if (String(o.msg).indexOf('NaN') !== -1) return base;
    return (o.waBase || WA_BASE) + encodeURIComponent(o.msg);
  }
  function etiquetaRadar(r) {
    return 'Preparación por dimensión. ' + r.dims.map(function (x) {
      return x.n + ': ' + x.s + ' de 100, nivel ' + LEVELS[x.l - 1];
    }).join('. ');
  }
  function etiquetaPilar(nombre, valor) { return nombre + ': ' + valor + ' de 4'; }
  function notaEmpate() { return 'Las seis dimensiones tienen el mismo puntaje. El orden de estas tres no indica cuál es peor.'; }

  function planEtapas(r, d) {
    var weakK = r.weak.map(function (x) { return x.k; });
    return WAVES.map(function (w, wi) {
      var acts = w.a.map(function (a) { return { t: a[0], k: a[1], pri: weakK.indexOf(a[1]) >= 0 }; });
      if (wi === 0 && r.route === 2) acts.unshift({ t: 'Revisión de riesgo de ' + (d.name ? '“' + d.name + '”' : 'tu caso principal'), k: 'rie', pri: true });
      acts.sort(function (a, b) { return (b.pri === a.pri) ? 0 : (b.pri ? 1 : -1); });
      return { w: w, acts: acts };
    });
  }

  /* Un solo avance pendiente. Siguiente/Anterior lo cancelan.
     Si el temporizador igual se dispara después, no avanza si el índice ya cambió. */
  function crearAvance(total) {
    var i = 0;
    var pending = null;
    function limpiar(clear) {
      if (pending !== null && clear) clear(pending);
      pending = null;
    }
    return {
      indice: function () { return i; },
      pendiente: function () { return pending !== null; },
      programar: function (set, clear, ms, alCumplir) {
        limpiar(clear);
        var desde = i;
        pending = set(function () {
          pending = null;
          if (i === desde && i < total - 1) {
            i += 1;
            if (alCumplir) alCumplir(i);
          }
        }, ms);
      },
      cancelar: function (clear) { limpiar(clear); },
      siguiente: function (clear) {
        limpiar(clear);
        if (i < total - 1) i += 1;
        return i;
      },
      anterior: function (clear) {
        limpiar(clear);
        if (i > 0) i -= 1;
        return i;
      },
      fijar: function (n, clear) {
        limpiar(clear);
        i = Math.max(0, Math.min(total - 1, n | 0));
        return i;
      },
      reiniciar: function (clear) { limpiar(clear); i = 0; }
    };
  }

  function textosVisibles() {
    var out = [];
    STEPS.forEach(function (s) {
      out.push(s.t);
      if (s.h) out.push(s.h);
      (s.o || []).forEach(function (o) { out.push(o); });
    });
    Object.keys(RECS).forEach(function (k) {
      var rec = RECS[k];
      out.push(rec.t, rec.w, rec.s);
      if (rec.def) out.push(rec.def[0], rec.def[1]);
      rec.a.forEach(function (a) { out.push(a); });
      (rec.lv || []).forEach(function (l) { out.push(l[1], l[2]); });
    });
    ROUTE_INFO.forEach(function (t) { out.push(t); });
    ROUTE_TXT.forEach(function (t) { out.push(t); });
    WAVES.forEach(function (w) {
      out.push(w.n, w.t, w.hz);
      w.a.forEach(function (a) { out.push(a[0]); });
    });
    out.push(LAW_BASE.n, LAW_BASE.w);
    LAWS.forEach(function (g) { g.forEach(function (l) { out.push(l.n, l.w); }); });
    out.push(tituloReporte('Inicial'), MOTIVO_ACOMP, MOTIVO_EVAL, KICKER.trim(), ETIQUETA_RIESGO, notaEmpate());
    var r = compute(SAMPLE);
    out.push(mensajeWhatsapp(r, nextService(r)));
    vinietas(r).forEach(function (v) { out.push(v); });
    out.push(htmlResumen('Caso de uso principal', r).replace(/<[^>]+>/g, ''));
    planEtapas(r, SAMPLE).forEach(function (s) { s.acts.forEach(function (a) { out.push(a.t); }); });
    return out;
  }

  return {
    SERVICIO_RUTA: SERVICIO_RUTA, SERVICIO_RIESGOS: SERVICIO_RIESGOS,
    DIMS: DIMS, LEVELS: LEVELS, ROUTES: ROUTES, RISKS: RISKS, TYPES: TYPES, AREAS: AREAS, AREA_REG: AREA_REG,
    AUT_SCALE: AUT_SCALE, AUT_RISK: AUT_RISK, STEPS: STEPS, RECS: RECS, SVC_URL: SVC_URL,
    ROUTE_INFO: ROUTE_INFO, ROUTE_TXT: ROUTE_TXT, WAVES: WAVES, LAW_BASE: LAW_BASE, LAWS: LAWS,
    SAMPLE: SAMPLE, WA_BASE: WA_BASE, PRIV: PRIV, ETIQUETA_RIESGO: ETIQUETA_RIESGO, KICKER: KICKER,
    RM: RM, RC: RC,
    esc: esc, lvl: lvl, low: low, autScale: autScale, autRisk: autRisk, entradasValidas: entradasValidas,
    compute: compute, nextService: nextService, tierRecomendada: tierRecomendada, motivoTier: motivoTier,
    tituloReporte: tituloReporte, comportamientoScroll: comportamientoScroll, htmlResumen: htmlResumen,
    vinietas: vinietas, textoTope: textoTope, mensajeWhatsapp: mensajeWhatsapp, hrefWhatsapp: hrefWhatsapp,
    etiquetaRadar: etiquetaRadar, etiquetaPilar: etiquetaPilar, notaEmpate: notaEmpate, planEtapas: planEtapas,
    crearAvance: crearAvance, textosVisibles: textosVisibles
  };
});
