/* Autoevaluación de IA · ÓNIX
   Todo corre en el navegador: las respuestas no se guardan ni se envían.
   El único envío posible es el mensaje de WhatsApp que la persona decide mandar. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('qOpts')) return;

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
    { p: 'c', k: 'datos', t: '¿Qué tipo de información usa?', o: ['Pública o interna sin riesgo', 'Confidencial del negocio', 'Datos personales, financieros u otros datos sensibles'] },
    { p: 'c', k: 'afect', t: '¿A quién afectan sus resultados?', o: ['Solo a empleados, uso interno', 'A proveedores o socios', 'A clientes o al público'] },
    { p: 'c', k: 'area', t: '¿En qué área se usa principalmente?', o: AREAS }
  ];

  var RECS = {
    est: { t: 'Liga cada uso de IA a una meta del negocio', w: 'Define para cada caso el beneficio esperado, su línea base y quién responde por él.', s: 'Ruta IA' },
    rol: { t: 'Nombra a un responsable y arma el inventario', w: 'Una persona aprueba herramientas y mantiene la lista de qué se usa, con qué cuenta y quién es el dueño.', s: 'Ruta IA' },
    dat: { t: 'Define qué datos no salen de la empresa', w: 'Escribe las reglas en una página, autoriza herramientas y actualiza tu aviso de privacidad para contemplar la IA.', s: 'Ruta IA' },
    rie: { t: 'Revisa riesgos antes de lanzar', w: 'Usa un checklist corto por caso y pide aprobación humana en decisiones que afecten a clientes.', s: 'Auditoría IA Confiable' },
    seg: { t: 'Controla accesos y prueba lo que construyes', w: 'Cuentas empresariales, permisos mínimos, pruebas antes de operar y monitoreo después.', s: 'Auditoría IA Confiable' },
    per: { t: 'Publica una política de uso y capacita', w: 'Una política clara de una página y una sesión por rol para que todo el equipo conozca las reglas.', s: 'Ruta IA' }
  };
  var SVC_URL = { 'Ruta IA': '/servicios/estrategia-de-ia', 'Auditoría IA Confiable': '/servicios/auditoria-de-ia' };
  var WAVES = [
    { n: 'Etapa 1 · Bases', hz: 'Para empezar', a: [['Responsable de IA', 'rol'], ['Inventario de herramientas y agentes', 'rol'], ['Reglas de datos y herramientas autorizadas', 'dat'], ['Política de uso aceptable', 'per']] },
    { n: 'Etapa 2 · Controles', hz: 'Cuando las bases estén listas', a: [['Checklist de riesgo antes de lanzar', 'rie'], ['Pruebas antes de operar', 'seg'], ['Aprobación humana en decisiones clave', 'rie'], ['Metas y métricas de valor por caso', 'est']] },
    { n: 'Etapa 3 · Mejora continua', hz: 'Para sostenerlo', a: [['Monitoreo en operación', 'seg'], ['Reevaluación ante cambios de modelo o datos', 'rie'], ['Capacitación por rol', 'per'], ['Revisión periódica de política y valor', 'est']] }
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

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var lvl = function (s) { return s < 25 ? 1 : s < 50 ? 2 : s < 75 ? 3 : 4; };
  var low = function (s) { return s.charAt(0).toLowerCase() + s.slice(1); };
  var RM = [[0, 1, 2], [1, 1, 2], [1, 2, 2]];
  var RC = ['c-ok', 'c-rev', 'c-alto'];

  function compute(d) {
    var dims = DIMS.map(function (D, i) {
      var a = (d.m[i * 2] + d.m[i * 2 + 1]) / 2;
      var s = Math.round((a - 1) / 3 * 100);
      return Object.assign({}, D, { s: s, l: lvl(s) });
    });
    var gs = Math.round(dims.reduce(function (t, x) { return t + x.s; }, 0) / dims.length);
    var minL = Math.min.apply(null, dims.map(function (x) { return x.l; }));
    var gl = lvl(gs), capped = false;
    if (gl > minL + 1) { gl = minL + 1; capped = true; }
    var capas = ['Gobierno', 'Riesgo', 'Seguridad'].map(function (c) {
      var ds = dims.filter(function (x) { return x.capa === c; });
      return { n: c, ds: ds, s: Math.round(ds.reduce(function (t, x) { return t + x.s; }, 0) / ds.length) };
    });
    var P = [d.proc, d.aut, d.pres];
    var tipo = (P.indexOf(4) >= 0 || P.filter(function (v) { return v >= 3; }).length >= 2) ? 2 : P.indexOf(3) >= 0 ? 1 : 0;
    var autR = d.aut === 1 ? 1 : d.aut === 4 ? 3 : 2;
    var factors = [{ n: 'Datos', v: d.datos }, { n: 'Afectados', v: d.afect }, { n: 'Autonomía', v: autR }, { n: 'Regulación', v: AREA_REG[d.area] }];
    var risk = Math.max.apply(null, factors.map(function (f) { return f.v; }));
    var highs = factors.filter(function (f) { return f.v === 3; }).length;
    var sorted = dims.slice().sort(function (a, b) { return a.s - b.s; });
    return { dims: dims, gs: gs, gl: gl, capped: capped, minL: minL, capas: capas, tipo: tipo, risk: risk, highs: highs, factors: factors, route: RM[tipo][risk - 1], weak: sorted.slice(0, 3), strong: sorted[sorted.length - 1] };
  }

  function nextService(r) { return r.route === 2 || ['rie', 'seg'].indexOf(r.weak[0].k) >= 0 ? 'Auditoría IA Confiable' : 'Ruta IA'; }

  function render(d) {
    var r = compute(d);
    var rep = $('reporte');
    rep.classList.remove('is-in');
    var flag = $('ribbon');
    flag.textContent = d.sample ? 'Reporte de ejemplo' : 'Tu reporte';
    flag.classList.toggle('is-yours', !d.sample);
    var org = d.org || 'Tu empresa';
    $('rOrg').textContent = org;
    $('rDate').textContent = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    $('rTitle').textContent = org + ' está en nivel ' + LEVELS[r.gl - 1] + ' de preparación para IA';
    var caseName = d.name ? '“' + esc(d.name) + '”' : 'Tu caso de uso principal';
    $('rExec').innerHTML = 'Con un índice de <em>' + r.gs + ' de 100</em>, tu mayor fortaleza está en ' + esc(low(r.strong.n)) + ' y tu principal brecha en ' + esc(low(r.weak[0].n)) + '. ' + caseName + ' es un uso <em>' + low(TYPES[r.tipo]) + '</em> con riesgo <em>' + low(RISKS[r.risk - 1]) + '</em>, así que le corresponde la ruta de gobierno <em>' + low(ROUTES[r.route]) + '</em>.';
    var routeTxt = ['basta con usar herramientas autorizadas, registrarlo en el inventario y aceptar la política de uso', 'pide revisión del responsable de IA, checklist de riesgo, reglas de datos y pruebas básicas antes de lanzar', 'pide aprobación de dirección, pruebas de seguridad, aprobación humana en decisiones clave y monitoreo continuo'];
    var weakCapa = r.capas.slice().sort(function (a, b) { return a.s - b.s; })[0];
    $('rBullets').innerHTML = [
      'Tu capa más débil es ' + low(weakCapa.n) + ' (' + weakCapa.s + ' de 100).',
      'Para este caso, la ruta ' + low(ROUTES[r.route]) + ' ' + routeTxt[r.route] + '.',
      r.capped ? 'El nivel global se limitó a ' + LEVELS[r.gl - 1] + ' porque una dimensión está en nivel ' + LEVELS[r.minL - 1] + '.' : 'Tu primera etapa debe atender ' + esc(low(r.weak[0].n)) + ' y ' + esc(low(r.weak[1].n)) + '.'
    ].map(function (t) { return '<li>' + t + '</li>'; }).join('');

    $('rKpis').innerHTML = [
      ['Índice global', r.gs + '<small> /100</small>'],
      ['Nivel', LEVELS[r.gl - 1]],
      ['Tipo de caso de uso', TYPES[r.tipo]],
      ['Riesgo', '<span class="ae-pill ' + RC[r.risk - 1] + '">' + RISKS[r.risk - 1] + '</span>'],
      ['Ruta de gobierno', '<span class="ae-pill ' + RC[r.route] + '">' + ROUTES[r.route] + '</span>'],
      ['Dimensión más baja', '<span style="font-size:1.0625rem;letter-spacing:-.01em">' + esc(r.weak[0].n) + '</span>']
    ].map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>'; }).join('');

    $('f1Title').textContent = 'Índice global de preparación: ' + r.gs + ' de 100';
    Array.prototype.forEach.call($('gBands').children, function (el, i) { el.classList.toggle('on', i === r.gl - 1); });
    $('gVal').textContent = r.gs;
    $('gMarker').style.left = '0%';
    var cf = $('capFlag');
    cf.hidden = !r.capped;
    if (r.capped) cf.textContent = 'Tope aplicado: el índice cae en ' + LEVELS[lvl(r.gs) - 1] + ', pero el nivel global queda en ' + LEVELS[r.gl - 1] + ' porque ' + low(r.weak[0].n) + ' está en ' + LEVELS[r.minL - 1] + '.';

    drawRadar(r);

    $('capas').innerHTML = r.capas.map(function (c) {
      return '<div><div class="capa__h"><b>' + c.n + '</b><span>' + c.s + ' / 100</span></div>' + c.ds.map(function (x) {
        return '<div class="bar" data-tip="' + esc(x.n) + ': ' + x.s + ' de 100, nivel ' + LEVELS[x.l - 1] + '"><span>' + esc(x.n) + '</span><div class="bar__track"><div class="bar__fill lv' + x.l + '" data-w="' + x.s + '"></div></div><span class="bar__v">' + x.s + '</span></div>';
      }).join('') + '</div>';
    }).join('');

    $('f4Title').textContent = 'Ruta de gobierno: ' + ROUTES[r.route];
    var m = '<div></div>' + RISKS.map(function (x) { return '<div class="h">' + x + '</div>'; }).join('');
    [2, 1, 0].forEach(function (t) {
      m += '<div class="h rh">' + TYPES[t] + '</div>';
      [0, 1, 2].forEach(function (k) {
        var here = t === r.tipo && k === r.risk - 1;
        m += '<div class="cell rt' + RM[t][k] + (here ? ' here' : '') + '" data-tip="' + TYPES[t] + ' con riesgo ' + low(RISKS[k]) + ': ruta ' + low(ROUTES[RM[t][k]]) + '">' + ROUTES[RM[t][k]] + (here ? '<span class="dot" role="img" aria-label="Tu caso"></span>' : '') + '</div>';
      });
    });
    $('matrix').innerHTML = m;

    var pr = [['Cambio en el proceso', d.proc], ['Autonomía', d.aut], ['Presencia', d.pres]];
    $('profile').innerHTML = '<p class="profile__name"><b>' + esc(d.name || 'Caso de uso principal') + '</b> · ' + esc(AREAS[d.area]) + '</p>' +
      pr.map(function (p) { return '<div class="p-row" data-tip="' + p[0] + ': ' + p[1] + ' de 4"><span>' + p[0] + '</span><div class="steps4">' + [1, 2, 3, 4].map(function (i) { return '<span class="' + (i <= p[1] ? 'on' : '') + '"></span>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="p-row" aria-hidden="true"><span></span><div class="steps4 steps4--lbl"><b>Apoyo</b><b>Ampliado</b><b>Integrado</b><b>Transforma</b></div></div>';
    $('factors').innerHTML = r.factors.map(function (f) { return '<span class="chip ' + RC[f.v - 1] + '"><span>' + f.n + '</span><b>' + RISKS[f.v - 1] + '</b></span>'; }).join('');
    $('esc').hidden = r.highs < 2;

    var weakK = r.weak.map(function (x) { return x.k; });
    $('road').innerHTML = WAVES.map(function (w, wi) {
      var acts = w.a.map(function (a) { return { t: a[0], k: a[1], pri: weakK.indexOf(a[1]) >= 0 }; });
      if (wi === 0 && r.route === 2) acts.unshift({ t: 'Revisión de riesgo de ' + (d.name ? '“' + d.name + '”' : 'tu caso principal'), k: 'rie', pri: true });
      acts.sort(function (a, b) { return b.pri - a.pri; });
      return '<div class="ae-wave"><div><h4>' + w.n + '</h4><span class="wave__hz">' + w.hz + '</span></div>' + acts.map(function (a) {
        return '<div class="act' + (a.pri ? ' pri' : '') + '">' + (a.pri ? '<span class="act__tag">Prioridad</span>' : '') + '<span>' + esc(a.t) + '</span><small>' + esc(DIMS.filter(function (x) { return x.k === a.k; })[0].n) + '</small></div>';
      }).join('') + '</div>';
    }).join('');

    $('prio').innerHTML = r.weak.map(function (x) {
      var rec = RECS[x.k];
      return '<li><div><h4>' + rec.t + '</h4><p>' + esc(x.n) + ': ' + x.s + ' de 100. ' + rec.w + '</p><p class="svc">Te ayuda: <a href="' + SVC_URL[rec.s] + '">' + rec.s + '</a></p></div></li>';
    }).join('');

    $('laws').innerHTML = [LAW_BASE].concat(LAWS[d.area]).map(function (l) { return '<li><b>' + esc(l.n) + '</b><span>' + esc(l.w) + '</span></li>'; }).join('');

    // CTA: siguiente paso y mensaje de WhatsApp con el resumen (sin datos personales)
    var svc = nextService(r);
    $('nextKicker').textContent = 'Siguiente paso recomendado: ' + svc;
    $('nextText').textContent = (svc === 'Ruta IA'
      ? 'Te ayudamos a decidir qué hacer con IA, en qué orden y con qué reglas, empezando por tus dimensiones más bajas.'
      : 'Revisamos la seguridad y los riesgos de la IA que ya usas, empezando por tu caso de uso principal.') + ' Tu consultoría inicial es gratis.';
    if (!d.sample) {
      var msg = 'Hola, hice la autoevaluación de IA de ÓNIX. Resultado: nivel ' + LEVELS[r.gl - 1] + ' (índice ' + r.gs + ' de 100); caso de uso ' + low(TYPES[r.tipo]) + ' con riesgo ' + low(RISKS[r.risk - 1]) + ', ruta ' + low(ROUTES[r.route]) + '. Prioridades: ' + r.weak.map(function (x) { return low(x.n); }).join(', ') + '. Me interesa ' + svc + '.' + PRIV;
      $('waCta').href = WA_BASE + encodeURIComponent(msg);
    }

    requestAnimationFrame(function () { requestAnimationFrame(function () {
      rep.classList.add('is-in');
      $('gMarker').style.left = r.gs + '%';
      Array.prototype.forEach.call(rep.querySelectorAll('.bar__fill'), function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
    }); });
  }

  function drawRadar(r) {
    var cx = 200, cy = 170, R = 112, n = DIMS.length;
    var pt = function (k, s) { var a = -Math.PI / 2 + k * 2 * Math.PI / n; return [cx + R * s / 100 * Math.cos(a), cy + R * s / 100 * Math.sin(a)]; };
    var poly = function (vals) { return vals.map(function (v, k) { return pt(k, v).map(function (x) { return x.toFixed(1); }).join(','); }).join(' '); };
    var g = '';
    [25, 75, 100].forEach(function (v) { g += '<polygon class="r-grid" points="' + poly(DIMS.map(function () { return v; })) + '"/>'; });
    g += '<polygon class="r-grid mid" points="' + poly(DIMS.map(function () { return 50; })) + '"/>';
    DIMS.forEach(function (D, k) {
      var p = pt(k, 100);
      g += '<line class="r-axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>';
      var l = pt(k, 118), lx = l[0], ly = l[1];
      var anc = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
      var dy = Math.abs(lx - cx) < 4 ? (ly < cy ? -16 : 12) : -4;
      g += '<text class="r-lbl" x="' + lx.toFixed(1) + '" y="' + (ly + dy).toFixed(1) + '" text-anchor="' + anc + '"><tspan x="' + lx.toFixed(1) + '">' + D.l[0] + '</tspan><tspan x="' + lx.toFixed(1) + '" dy="14">' + D.l[1] + '</tspan></text>';
    });
    [25, 50, 75].forEach(function (v) { var p = pt(0, v); g += '<text class="r-tick" x="' + (p[0] + 4).toFixed(1) + '" y="' + (p[1] + 3).toFixed(1) + '">' + v + '</text>'; });
    g += '<polygon class="r-area" points="' + poly(r.dims.map(function (x) { return Math.max(x.s, 2); })) + '"/>';
    r.dims.forEach(function (x, k) { var p = pt(k, Math.max(x.s, 2)); g += '<circle class="r-pt" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" data-tip="' + esc(x.n) + ': ' + x.s + ' de 100, ' + LEVELS[x.l - 1] + '"/>'; });
    $('radar').innerHTML = g;
  }

  // Tooltip
  var tip = $('tip'), rep = $('reporte');
  function showTip(e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || !rep.contains(t)) { tip.classList.remove('show'); return; }
    var b = t.getBoundingClientRect(), rb = rep.getBoundingClientRect();
    tip.textContent = t.getAttribute('data-tip');
    var x = Math.max(130, Math.min(rb.width - 130, b.left + b.width / 2 - rb.left));
    tip.style.left = x + 'px';
    tip.style.top = (b.top - rb.top) + 'px';
    tip.classList.add('show');
  }
  rep.addEventListener('pointerover', showTip);
  rep.addEventListener('pointerleave', function () { tip.classList.remove('show'); });
  rep.addEventListener('click', showTip);

  // Cuestionario
  var i = 0, ans = {};
  var key = function (s) { return s.p === 'm' ? 'm' + STEPS.indexOf(s) : s.k; };
  function q(focus) {
    var s = STEPS[i];
    $('qPart').textContent = s.p === 'm' ? 'Parte 1 de 2 · ' + DIMS[s.d].n : 'Parte 2 de 2 · Tu caso de uso principal';
    $('qCount').textContent = (i + 1) + ' de ' + STEPS.length;
    $('qProg').style.width = (i / STEPS.length * 100) + '%';
    $('qText').textContent = s.t;
    $('qHelp').textContent = s.h || '';
    $('qHelp').hidden = !s.h;
    var box = $('qOpts'); box.innerHTML = '';
    if (s.type === 'text') {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'quiz__input'; inp.maxLength = 80; inp.placeholder = 'Describe tu caso de uso'; inp.autocomplete = 'off';
      inp.setAttribute('aria-labelledby', 'q-title');
      inp.value = ans.name || '';
      inp.addEventListener('input', function () { ans.name = inp.value.trim(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('qNext').click(); } });
      box.appendChild(inp);
      $('qNext').disabled = false;
      if (focus) inp.focus();
    } else {
      s.o.forEach(function (txt, k) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'opt';
        b.setAttribute('aria-pressed', ans[key(s)] === k + 1 ? 'true' : 'false');
        b.innerHTML = '<span class="opt__k" aria-hidden="true">' + 'ABCDEF'[k] + '</span><span></span>';
        b.lastChild.textContent = txt;
        b.addEventListener('click', function () {
          ans[key(s)] = k + 1; q();
          setTimeout(function () { if (i < STEPS.length - 1) { i++; q(true); } }, 200);
        });
        box.appendChild(b);
      });
      $('qNext').disabled = !ans[key(s)];
      if (focus) { var sel = box.querySelector('[aria-pressed="true"]') || box.firstChild; if (sel) sel.focus({ preventScroll: true }); }
    }
    $('qBack').disabled = i === 0;
    $('qNext').textContent = i === STEPS.length - 1 ? 'Ver mi reporte' : 'Siguiente';
  }
  $('qNext').addEventListener('click', function () {
    if (i < STEPS.length - 1) { i++; q(true); return; }
    var d = { m: STEPS.filter(function (s) { return s.p === 'm'; }).map(function (s) { return ans[key(s)]; }), name: ans.name || '', proc: ans.proc, aut: ans.aut, pres: ans.pres, datos: ans.datos, afect: ans.afect, area: ans.area - 1, org: '', sample: false };
    $('qProg').style.width = '100%';
    $('qBody').hidden = true; $('qDone').hidden = false;
    render(d);
    rep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    rep.focus({ preventScroll: true });
  });
  $('qBack').addEventListener('click', function () { if (i > 0) { i--; q(true); } });
  $('qRestart').addEventListener('click', function () {
    ans = {}; i = 0; $('qBody').hidden = false; $('qDone').hidden = true; q();
    $('cuestionario').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('printBtn').addEventListener('click', function () {
    rep.classList.add('is-in');
    window.print();
  });

  // El botón flotante de contacto se oculta mientras el cuestionario está en pantalla
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { document.body.classList.toggle('ae-quiz-on', es[0].isIntersecting); }, { threshold: .15 }).observe($('cuestionario'));
  }

  q();
  render(SAMPLE);
})();
