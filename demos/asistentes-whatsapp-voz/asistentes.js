/* Asistentes de WhatsApp y Voz · demo ilustrativa. Todo simulado en el navegador:
   sin backend, sin llamadas externas, sin micrófono y sin reproducción de audio. Datos ficticios. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LAST = 4;

  var STEP_NAMES = { 1: 'Se presenta', 2: 'Responde y admite lo que no sabe', 3: 'Anota la solicitud', 4: 'Pasa con una persona' };
  var WHO = {
    1: 'Participa: la asistente virtual',
    2: 'Participa: la base de respuestas aprobada',
    3: 'Participan: el registro de solicitudes y una persona del equipo',
    4: 'Participan: la transferencia y una persona del equipo'
  };

  // Mismo guion en los dos canales; cambia la redacción según sea mensaje o llamada.
  var SCRIPT = {
    wa: [
      { k: 'w1', s: 1, side: 'in', who: 'Andrés Demo (cliente ficticio)', text: 'Hola, buenas noches. ¿Qué horarios tienen?' },
      { k: 'w2', s: 1, side: 'ai', who: 'Asistente virtual', text: 'Hola, soy la asistente virtual de Negocio Ejemplo. Puedo ayudarte con información y anotar tu solicitud; si prefieres hablar con una persona, dímelo.', chip: 'Aviso de privacidad del negocio' },
      { k: 'w3', s: 2, side: 'ai', who: 'Asistente virtual', text: 'Atendemos de lunes a viernes. Hoy es domingo, así que el equipo no está en línea.' },
      { k: 'w4', s: 2, side: 'in', who: 'Andrés Demo', text: '¿Qué incluye la asesoría?' },
      { k: 'w5', s: 2, side: 'ai', who: 'Asistente virtual', text: 'Incluye una conversación para entender lo que necesitas y una recomendación por escrito.' },
      { k: 'w6', s: 2, side: 'in', who: 'Andrés Demo', text: '¿Tienen estacionamiento?' },
      { k: 'w7', s: 2, side: 'ai', who: 'Asistente virtual', text: 'Ese dato no lo tengo aprobado y no quiero inventarlo. Lo paso al equipo para que te lo confirme.' },
      { k: 'w8', s: 3, side: 'in', who: 'Andrés Demo', text: 'Quiero una cita el martes.' },
      { k: 'w9', s: 3, side: 'ai', who: 'Asistente virtual', text: 'Con gusto la anoto. ¿La prefieres en la mañana o en la tarde?' },
      { k: 'w10', s: 3, side: 'in', who: 'Andrés Demo', text: 'En la tarde.' },
      { k: 'w11', s: 3, side: 'ai', who: 'Asistente virtual', text: 'Queda anotado y se lo mando al equipo de Negocio Ejemplo. La cita la confirma una persona del equipo; yo no puedo confirmarla.' },
      { k: 'w12', s: 4, side: 'in', who: 'Andrés Demo', text: 'Mejor quiero hablar con una persona.' },
      { k: 'w13', s: 4, side: 'ai', who: 'Asistente virtual', text: 'Claro. Te paso con una persona del equipo y le comparto un resumen para que no repitas nada. Como ahora no están en línea, dejo tu recado y les aviso; no puedo prometerte cuándo te contestarán.' }
    ],
    // [REVISIÓN ABOGADO] PROVISIONAL: la apertura de voz (k: 'v1') es el texto sugerido por Legal (transcripción, aviso de asistente virtual y aviso de privacidad);
    // requiere revisión de abogado humano antes de publicarse. No es texto final.
    voice: [
      { k: 'v1', s: 1, side: 'ai', who: 'Asistente virtual', text: 'Hola, soy la asistente virtual de Negocio Ejemplo. Esta llamada se transcribe para atenderte y mejorar el servicio. Te puedo enviar el aviso de privacidad por WhatsApp. Si prefieres hablar con una persona, dímelo.' },
      { k: 'v2', s: 1, side: 'in', who: 'Andrés Demo (cliente ficticio)', text: 'Hola, llamo para saber qué horarios tienen.' },
      { k: 'v3', s: 2, side: 'ai', who: 'Asistente virtual', text: 'Atendemos de lunes a viernes. Hoy es domingo, así que el equipo no está en línea.' },
      { k: 'v4', s: 2, side: 'in', who: 'Andrés Demo', text: '¿Y qué incluye la asesoría?' },
      { k: 'v5', s: 2, side: 'ai', who: 'Asistente virtual', text: 'Una conversación para entender lo que necesitas y una recomendación por escrito.' },
      { k: 'v6', s: 2, side: 'in', who: 'Andrés Demo', text: '¿Tienen estacionamiento?' },
      { k: 'v7', s: 2, side: 'ai', who: 'Asistente virtual', text: 'Ese dato no lo tengo aprobado y no quiero inventarlo. Lo paso al equipo para que te lo confirme.' },
      { k: 'v8', s: 3, side: 'in', who: 'Andrés Demo', text: 'Quiero una cita el martes, en la tarde.' },
      { k: 'v9', s: 3, side: 'ai', who: 'Asistente virtual', text: 'Queda anotado y se lo mando al equipo de Negocio Ejemplo. La cita la confirma una persona del equipo; yo no puedo confirmarla.' },
      { k: 'v10', s: 4, side: 'in', who: 'Andrés Demo', text: 'Prefiero hablar con una persona.' },
      { k: 'v11', s: 4, side: 'ai', who: 'Asistente virtual', text: 'Claro. Como ahora no hay nadie en línea, tomo tu recado con un resumen de lo que platicamos y aviso al equipo. No puedo prometerte cuándo te devolverán la llamada.' }
    ]
  };

  var state;
  function fresh() { return { step: 1, channel: 'wa', seen: {} }; }
  state = fresh();

  var stage = $('#stage'), chat = $('#chat'), live = $('#live');
  var prevBtn = $('#prev'), nextBtn = $('#next'), resetBtn = $('#reset');

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  var PLAY = '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>';
  function waveEl() {
    var w = el('span', 'vb__wave'); w.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 16; i++) { var b = document.createElement('i'); b.style.setProperty('--w', i); w.appendChild(b); }
    return w;
  }

  function renderChat() {
    var voice = state.channel === 'voice';
    var items = SCRIPT[state.channel].filter(function (m) { return m.s <= state.step; });
    var shown = {}, idx = 0;
    chat.textContent = '';
    chat.className = 'chat' + (voice ? ' is-voice' : '');
    chat.setAttribute('aria-label', voice ? 'Transcripción de la llamada de ejemplo' : 'Conversación de ejemplo por WhatsApp');
    if (!voice) chat.appendChild(el('div', 'chat__day', 'Domingo en la noche · conversación ficticia'));
    items.forEach(function (m, n) {
      var node;
      var last = n === items.length - 1;
      if (voice) {
        node = el('div', 'vb ' + (m.side === 'ai' ? 'vb--ai' : 'vb--out') + (last && m.side === 'ai' ? ' vb--last' : ''));
        var bub = el('span', 'vb__bubble'); bub.setAttribute('aria-hidden', 'true');
        var play = el('i', 'vb__play'); play.innerHTML = PLAY; bub.appendChild(play); bub.appendChild(waveEl());
        node.appendChild(bub);
        var t = el('p', 'vb__text'); t.appendChild(el('b', null, m.who)); t.appendChild(document.createTextNode(m.text));
        node.appendChild(t);
      } else {
        node = el('div', 'msg ' + (m.side === 'ai' ? 'msg--out' : 'msg--in'));
        node.appendChild(el('span', 'msg__who', m.who));
        node.appendChild(el('span', 'msg__text', m.text));
        if (m.chip) { node.appendChild(document.createElement('br')); node.appendChild(el('span', 'msg__chip', m.chip)); }
      }
      var key = state.channel + m.k;
      if (!state.seen[key]) { node.classList.add('is-new'); node.style.setProperty('--i', idx++); }
      shown[key] = true;
      chat.appendChild(node);
    });
    if (state.step >= 3) {
      var s = el('div', 'chat__sys chat__sys--pend', state.step >= 4 ? 'Transferido con resumen. Esperando a una persona del equipo.' : 'Solicitud anotada. Pendiente de confirmación por una persona.');
      var sk = state.channel + 'sys' + state.step;
      if (!state.seen[sk]) s.classList.add('is-new');
      shown[sk] = true;
      chat.appendChild(s);
    }
    state.seen = shown;
    chat.scrollTop = chat.scrollHeight;
  }

  function renderChannel() {
    var voice = state.channel === 'voice';
    stage.setAttribute('data-channel', state.channel);
    $$('[data-channel]', document.querySelector('.seg')).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-channel') === state.channel));
    });
    $$('[data-ch]').forEach(function (n) { n.hidden = n.getAttribute('data-ch') !== state.channel; });
    $('#phone-head').hidden = voice;
    $('#callbar').hidden = !voice;
    $('#phone-sim').textContent = voice ? 'Llamada simulada: se muestra la transcripción; no hay micrófono ni audio.' : 'Conversación simulada de WhatsApp.';
    $('#req-channel').textContent = voice ? 'Por esta llamada, o por WhatsApp si lo prefiere' : 'Por este chat de WhatsApp';
  }

  function render(announce) {
    var s = state.step;
    stage.setAttribute('data-step', String(s));
    $$('.step').forEach(function (b) {
      var n = Number(b.getAttribute('data-go'));
      if (n === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', n < s);
    });
    $$('.view').forEach(function (v) { v.hidden = Number(v.getAttribute('data-view')) !== s; });
    $('#who').textContent = WHO[s];
    renderChannel();
    renderChat();
    prevBtn.disabled = s === 1;
    nextBtn.disabled = s === LAST;
    if (announce) live.textContent = (state.channel === 'voice' ? 'Por voz. ' : 'Por WhatsApp. ') + STEP_NAMES[s];
  }
  function go(n) { state.step = Math.max(1, Math.min(LAST, n)); render(true); }

  $$('.step').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
  $$('.seg button').forEach(function (b) {
    b.addEventListener('click', function () { state.channel = b.getAttribute('data-channel'); render(true); });
  });
  prevBtn.addEventListener('click', function () { go(state.step - 1); });
  nextBtn.addEventListener('click', function () { go(state.step + 1); });
  resetBtn.addEventListener('click', function () { state = fresh(); render(false); live.textContent = 'Demo reiniciada. ' + STEP_NAMES[1]; });

  render(false);
})();
