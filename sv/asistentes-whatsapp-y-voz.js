/* ÓNIX · Asistentes de WhatsApp y Voz: "Pruébalo".
   El visitante elige canal (WhatsApp o voz) y una de tres preguntas de ejemplo; la asistente virtual responde
   con un guion fijo de datos ficticios. Solo botones (aria-pressed), sin campos de texto, sin dependencias.
   Sin JS, el HTML ya muestra una conversación completa (WhatsApp, primera pregunta). */
(function () {
  'use strict';
  var d = document;
  var box = d.querySelector('[data-aw-try]');
  if (!box) return;
  var phone = box.querySelector('.aw-phone--try');
  var thread = box.querySelector('[data-aw-thread]');
  var sub = box.querySelector('[data-aw-sub]');
  var out = box.querySelector('[data-aw-out]');
  var outT = box.querySelector('[data-aw-out-t]');
  var outP = box.querySelector('[data-aw-out-p]');
  var chBtns = [].slice.call(d.querySelectorAll('.aw-seg__b[data-ch]'));
  var qBtns = [].slice.call(d.querySelectorAll('.aw-q[data-q]'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var INTRO = {
    wa: 'Hola, soy la asistente virtual de Negocio Ejemplo. Puedo ayudarte con información y anotar tu solicitud; si prefieres hablar con una persona, dímelo.',
    voz: 'Hola, soy la asistente virtual de Negocio Ejemplo. Esta llamada se transcribe para atenderte. Si prefieres que no se transcriba, o hablar con una persona, dime en cualquier momento.'
  };
  var GUION = {
    modelo: {
      q: '¿Tienen el modelo en color negro?',
      wa: 'Con gusto te ayudo. ¿Cuántas piezas necesitas y lo quieres a domicilio o pasas a recoger? Anoto tu solicitud y alguien del equipo te confirma por aquí.',
      voz: 'Con gusto te ayudo con eso. ¿Cuántas piezas y a dónde te lo enviamos? Te mando el resumen por WhatsApp y alguien del equipo te lo confirma.',
      sys: 'Solicitud anotada · la confirma tu equipo',
      t: 'Anotó la solicitud y avisó al equipo.',
      p: 'No confirma disponibilidad ni citas por su cuenta: eso lo hace una persona.'
    },
    asesoria: {
      q: '¿Qué incluye la asesoría?',
      wa: 'Incluye una conversación para entender lo que necesitas y una recomendación por escrito. ¿Quieres que anote una solicitud de cita? La confirma una persona del equipo.',
      voz: 'Incluye una conversación para entender lo que necesitas y una recomendación por escrito. Si quieres, anoto una solicitud de cita y una persona del equipo te la confirma.',
      sys: 'Respuesta tomada de la información aprobada',
      t: 'Respondió con información aprobada.',
      p: 'Usa solo lo que tu equipo revisó y aprobó, con el tono de tu negocio.'
    },
    estacionamiento: {
      q: '¿Hay estacionamiento?',
      wa: 'No tengo ese dato confirmado y prefiero no inventarlo. Te paso con una persona del equipo y le dejo el resumen para que no tengas que repetir nada.',
      voz: 'No tengo ese dato confirmado y prefiero no inventarlo. Te paso con una persona del equipo y le dejo el resumen para que no tengas que repetir nada.',
      hand: true,
      t: 'Pasó la conversación a una persona.',
      p: 'Sin dato aprobado, no inventa: tu equipo recibe la conversación con su resumen y la pregunta queda anotada para mejorar la base.'
    }
  };

  var canal = 'wa', pregunta = 'modelo', timers = [];

  function limpiar() { timers.forEach(clearTimeout); timers = []; }
  function luego(ms, fn) { if (reduce) { fn(); return; } timers.push(setTimeout(fn, ms)); }
  function el(tag, cls, txt) { var n = d.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; }
  function onda(n) {
    var w = el('span', 'aw-wave aw-wave--sm'); w.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < n; i++) w.appendChild(d.createElement('i'));
    return w;
  }
  function burbuja(quien, texto) {
    var b = el('p', 'aw-b aw-b--' + quien + ' is-new');
    if (quien === 'ai') b.appendChild(el('span', 'aw-b__who', canal === 'voz' ? 'Asistente virtual · voz' : 'Asistente virtual'));
    if (quien === 'me' && canal === 'voz') b.appendChild(el('span', 'aw-b__who', 'Cliente · voz'));
    if (canal === 'voz') b.appendChild(onda(quien === 'ai' ? 14 : 8));
    b.appendChild(d.createTextNode(texto));
    return b;
  }
  function paseAPersona() {
    var c = el('div', 'aw-b aw-b--hand is-new');
    var top = el('div', 'aw-hand__top');
    var av = el('span', 'aw-hand__av', 'ME'); av.setAttribute('aria-hidden', 'true');
    var tx = el('span');
    tx.appendChild(el('strong', '', 'Pasa a Mariana Ejemplo'));
    tx.appendChild(el('small', '', 'Persona del equipo · ' + (canal === 'voz' ? 'transferencia de llamada' : 'misma conversación')));
    top.appendChild(av); top.appendChild(tx);
    c.appendChild(top);
    c.appendChild(el('p', '', 'Resumen: Cliente Ejemplo preguntó por estacionamiento. No hay dato aprobado en la base. Canal: ' + (canal === 'voz' ? 'llamada' : 'WhatsApp') + '.'));
    c.appendChild(el('span', 'state', 'Esperando a una persona del equipo'));
    return c;
  }
  function escribiendo() {
    var t = el('span', 'aw-typing is-new'); t.setAttribute('aria-hidden', 'true');
    t.appendChild(d.createElement('i')); t.appendChild(d.createElement('i')); t.appendChild(d.createElement('i'));
    return t;
  }
  function agregar(n) { thread.appendChild(n); thread.scrollTop = thread.scrollHeight; }
  function quitar(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }

  function render() {
    limpiar();
    var g = GUION[pregunta];
    phone.setAttribute('data-ch', canal);
    sub.textContent = canal === 'voz' ? 'Llamada · contestó la asistente virtual' : 'WhatsApp · asistente virtual';
    out.classList.toggle('is-person', !!g.hand);
    out.style.opacity = '.45';
    thread.setAttribute('aria-busy', 'true');
    thread.innerHTML = '';
    agregar(burbuja('ai', INTRO[canal]));
    luego(700, function () { agregar(burbuja('me', g.q)); });
    var tip;
    luego(1300, function () { tip = escribiendo(); agregar(tip); });
    luego(2400, function () {
      quitar(tip);
      agregar(burbuja('ai', g[canal]));
    });
    luego(3200, function () {
      if (g.hand) agregar(paseAPersona());
      else agregar(el('p', 'aw-b aw-b--sys is-new', g.sys));
      outT.textContent = g.t;
      outP.textContent = g.p;
      out.style.opacity = '';
      thread.removeAttribute('aria-busy');
    });
  }

  function marcar(btns, attr, val) {
    btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === val ? 'true' : 'false'); });
  }
  chBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      canal = b.getAttribute('data-ch');
      marcar(chBtns, 'data-ch', canal);
      render();
    });
  });
  qBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      pregunta = b.getAttribute('data-q');
      marcar(qBtns, 'data-q', pregunta);
      render();
    });
  });
})();
