/* Radar de Leads · demo ilustrativa. Estado simulado en el navegador, sin backend.
   Todos los datos son ficticios. El primer contacto NUNCA se envía sin la aprobación explícita de una persona. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var LAST = 4;
  var STEP_NAMES = {
    1: 'Llega un mensaje',
    2: 'Se arma la ficha',
    3: 'Una persona aprueba',
    4: 'Embudo y bitácora'
  };
  var WHO = {
    1: 'Participan: el Captador y la asistente virtual',
    2: 'Participa: el Calificador',
    3: 'Participan: el Redactor y una persona del equipo',
    4: 'Participan: Seguimiento y el Orquestador'
  };
  var FICHA_SUB = {
    1: 'El Captador crea una ficha única, con el canal de origen y el permiso de la prospecta registrados.',
    2: 'La ficha se completa con las respuestas de Laura y el Calificador sugiere una prioridad con su explicación.'
  };

  // Conversación ficticia por paso
  var CHAT = [
    { k: 'a1', s: 1, side: 'in', who: 'Laura Ejemplo (prospecta ficticia)', text: 'Hola, buenas tardes. Vi su servicio de mantenimiento y quisiera información.' },
    { k: 'a2', s: 1, side: 'out', who: 'Asistente virtual', text: 'Hola, soy la asistente virtual de Comercial Ejemplo. ¿Te puedo hacer unas preguntas para que la persona indicada te atienda?', chip: 'Aviso de privacidad del negocio' },
    { k: 'a3', s: 1, side: 'in', who: 'Laura Ejemplo', text: 'Sí, adelante.' },
    { k: 'b1', s: 2, side: 'out', who: 'Asistente virtual', text: 'Gracias, Laura. ¿Qué necesitas?' },
    { k: 'b2', s: 2, side: 'in', who: 'Laura Ejemplo', text: 'Mantenimiento para mi local. Lo necesito pronto.' },
    { k: 'b3', s: 2, side: 'out', who: 'Asistente virtual', text: '¿Para cuándo lo necesitas y cómo prefieres que te contactemos?' },
    { k: 'b4', s: 2, side: 'in', who: 'Laura Ejemplo', text: 'Esta semana. Por WhatsApp, en la tarde.' },
    { k: 'b5', s: 2, side: 'out', who: 'Asistente virtual', text: 'Listo. Una persona del equipo revisará tu caso. Si prefieres hablar con alguien antes, dímelo y te paso con una persona.' }
  ];

  var ORIGINAL_DRAFT = $('#draft-text').value;

  var state;
  function fresh() { return { step: 1, approved: false, edited: false, text: ORIGINAL_DRAFT, reviewed: false, seen: {} }; }
  state = fresh();

  var stage = $('#stage'), chat = $('#chat'), live = $('#live');
  var prevBtn = $('#prev'), nextBtn = $('#next'), resetBtn = $('#reset');
  var ta = $('#draft-text'), reviewed = $('#reviewed'), approveBtn = $('#approve');
  var draft = $('#draft'), statusChip = $('#status'), done = $('#done');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ── Chat ── */
  function renderChat() {
    var items = CHAT.filter(function (m) { return m.s <= Math.min(state.step, 2); }).map(function (m) { return { k: m.k, m: m }; });
    var shown = {};
    chat.textContent = '';
    var day = el('div', 'chat__day', 'Hoy · conversación ficticia');
    chat.appendChild(day);
    var idx = 0;
    items.forEach(function (it) {
      var m = it.m;
      var b = el('div', 'msg msg--' + m.side);
      b.appendChild(el('span', 'msg__who', m.who));
      b.appendChild(el('span', 'msg__text', m.text));
      if (m.chip) { b.appendChild(document.createElement('br')); b.appendChild(el('span', 'msg__chip', m.chip)); }
      if (!state.seen[it.k]) { b.classList.add('is-new'); b.style.setProperty('--i', idx++); }
      shown[it.k] = true;
      chat.appendChild(b);
    });
    if (state.step >= 3) {
      if (!state.approved) {
        var p = el('div', 'chat__sys chat__sys--pend', 'Borrador en espera de aprobación. Nada se ha enviado a Laura.');
        if (!state.seen.pend) p.classList.add('is-new');
        shown.pend = true;
        chat.appendChild(p);
      } else {
        var o = el('div', 'msg msg--out');
        o.appendChild(el('span', 'msg__who', 'Valeria Ejemplo (persona del equipo)'));
        o.appendChild(el('span', 'msg__text', state.text));
        if (!state.seen.sent) o.classList.add('is-new');
        shown.sent = true;
        chat.appendChild(o);
        var s = el('div', 'chat__sys chat__sys--ok', 'Enviado después de la aprobación de una persona.');
        if (!state.seen.sentsys) s.classList.add('is-new');
        s.style.setProperty('--i', 1);
        shown.sentsys = true;
        chat.appendChild(s);
      }
    }
    state.seen = shown;
    chat.scrollTop = chat.scrollHeight;
  }

  /* ── Ficha (pasos uno y dos) ── */
  function renderFicha() {
    var step = state.step;
    var i = 0;
    $$('#ficha .ficha__row').forEach(function (row) {
      var from = Number(row.getAttribute('data-from'));
      var dd = $('dd', row);
      if (!dd.hasAttribute('data-v')) dd.setAttribute('data-v', dd.textContent);
      var filled = from <= step;
      var wasFilled = row.classList.contains('is-filled');
      row.classList.toggle('is-empty', !filled);
      row.classList.toggle('is-filled', filled);
      dd.textContent = filled ? dd.getAttribute('data-v') : 'Por completar con las respuestas de Laura…';
      row.classList.remove('is-fresh');
      if (filled && !wasFilled && from > 1) { row.classList.add('is-fresh'); row.style.setProperty('--i', i++); }
    });
    $('#prio').hidden = step < 2;
    $('#ficha-sub').textContent = FICHA_SUB[Math.min(step, 2)];
  }

  /* ── Aprobación (paso tres) ── */
  function renderApproval() {
    ta.value = state.text;
    ta.readOnly = state.approved;
    reviewed.checked = state.reviewed || state.approved;
    reviewed.disabled = state.approved;
    updateApproveBtn();
    draft.setAttribute('data-state', state.approved ? 'approved' : 'pending');
    statusChip.className = 'chip ' + (state.approved ? 'chip--ok' : 'chip--pend');
    statusChip.textContent = state.approved ? 'Aprobado por una persona' : 'Pendiente de aprobación';
    done.hidden = !state.approved;
    if (state.approved) {
      done.textContent = 'Valeria Ejemplo, persona del equipo, ' + (state.edited ? 'editó y aprobó' : 'revisó y aprobó') + ' este primer contacto. Solo entonces se envió.';
    }
  }
  function updateApproveBtn() {
    approveBtn.disabled = state.approved || !(reviewed.checked && ta.value.trim().length > 0);
  }

  /* ── Embudo y bitácora (paso cuatro) ── */
  var OTHERS = {
    nuevos: [
      { n: 'Sofía Ejemplo', p: 'media' },
      { n: 'Marco Ejemplo', p: 'baja' }
    ],
    calif: [
      { n: 'Andrés Ejemplo', p: 'media' }
    ],
    persona: [
      { n: 'Camila Ejemplo', p: 'alta' }
    ]
  };
  var PRIO = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

  function card(lead, hl) {
    var c = el('li', 'lead-card' + (hl ? ' lead-card--hl' : ''));
    c.appendChild(el('strong', null, lead.n));
    c.appendChild(el('span', 'chip chip--' + lead.p, PRIO[lead.p]));
    if (lead.status) c.appendChild(el('span', 'chip ' + lead.statusCls, lead.status));
    return c;
  }
  function renderFunnel() {
    var f = $('#funnel');
    f.textContent = '';
    var laura = { n: 'Laura Ejemplo', p: 'alta' };
    var cols = [
      { t: 'Nuevos', list: OTHERS.nuevos.map(function (x) { return { lead: x }; }) },
      { t: 'En calificación', list: OTHERS.calif.map(function (x) { return { lead: x }; }) },
      { t: 'Primer contacto por aprobar', list: [] },
      { t: 'Con una persona del equipo', list: OTHERS.persona.map(function (x) { return { lead: x }; }) }
    ];
    if (state.approved) {
      cols[3].list.unshift({ lead: laura, hl: true });
    } else {
      laura.status = 'Pendiente de aprobación'; laura.statusCls = 'chip--pend';
      cols[2].list.push({ lead: laura, hl: true });
    }
    cols.forEach(function (c) {
      var col = el('section', 'fcol');
      var h = el('h4', 'fcol__title', c.t);
      var ul = el('ul', 'fcol__list');
      ul.setAttribute('aria-label', c.t);
      c.list.forEach(function (x) { ul.appendChild(card(x.lead, x.hl)); });
      if (!c.list.length) { var e = el('li', 'lead-card', 'Sin prospectos en esta etapa'); e.style.color = '#4A4A52'; ul.appendChild(e); }
      col.appendChild(h); col.appendChild(ul); f.appendChild(col);
    });
  }
  function renderLog() {
    var rows = [
      ['Captador', 'agente', 'Creó la ficha de Laura Ejemplo (origen: WhatsApp) y registró su permiso.'],
      ['Asistente virtual', 'agente', 'Se presentó como asistente virtual, compartió el aviso de privacidad y le hizo preguntas de calificación.'],
      ['Calificador', 'agente', 'Sugirió prioridad alta y dejó la explicación por escrito.'],
      ['Redactor', 'agente', 'Dejó un borrador de primer contacto en la cola de aprobación.']
    ];
    var ol = $('#log');
    ol.textContent = '';
    rows.forEach(function (r) { ol.appendChild(logRow(r[0], r[1], r[2])); });
    if (state.approved) {
      ol.appendChild(logRow('Valeria Ejemplo', 'persona', (state.edited ? 'Editó y aprobó' : 'Revisó y aprobó') + ' el primer contacto. Solo entonces se envió.'));
      ol.appendChild(logRow('Seguimiento', 'agente', 'Dejó un recordatorio interno para Valeria: dar el siguiente paso acordado con Laura.'));
    } else {
      var li = logRow('Valeria Ejemplo', 'pend', 'Aprobación pendiente. Mientras tanto, no se ha enviado ningún mensaje a Laura.');
      li.classList.add('is-pending');
      ol.appendChild(li);
    }
  }
  function logRow(who, kind, text) {
    var li = el('li');
    var a = el('div', 'log__actor');
    a.appendChild(el('span', null, who));
    if (kind === 'persona') a.appendChild(el('span', 'chip chip--persona', 'Persona'));
    else if (kind === 'pend') a.appendChild(el('span', 'chip chip--pend', 'Pendiente de aprobación'));
    else a.appendChild(el('span', 'chip chip--agente', 'Automatizado'));
    li.appendChild(a);
    li.appendChild(el('span', null, text));
    return li;
  }

  /* ── Navegación ── */
  function render(announce) {
    var s = state.step;
    stage.setAttribute('data-step', String(s));
    $$('.step').forEach(function (b) {
      var n = Number(b.getAttribute('data-go'));
      if (n === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', n < s);
    });
    $('#who').textContent = WHO[s];
    $('[data-view="ficha"]').hidden = !(s === 1 || s === 2);
    $('[data-view="aprobacion"]').hidden = s !== 3;
    $('[data-view="resumen"]').hidden = s !== 4;
    if (s <= 2) renderFicha();
    if (s === 3) renderApproval();
    if (s === 4) { renderFunnel(); renderLog(); }
    renderChat();
    prevBtn.disabled = s === 1;
    nextBtn.disabled = s === LAST;
    if (announce) live.textContent = STEP_NAMES[s] + (s === 3 && !state.approved ? '. Hay un borrador pendiente de aprobación.' : '');
  }
  function go(n) { state.step = Math.max(1, Math.min(LAST, n)); render(true); }

  $$('.step').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
  prevBtn.addEventListener('click', function () { go(state.step - 1); });
  nextBtn.addEventListener('click', function () { go(state.step + 1); });
  resetBtn.addEventListener('click', function () {
    state = fresh();
    render(false);
    live.textContent = 'Demo reiniciada. ' + STEP_NAMES[1];
  });

  ta.addEventListener('input', function () {
    state.text = ta.value;
    state.edited = ta.value.trim() !== ORIGINAL_DRAFT.trim();
    updateApproveBtn();
  });
  reviewed.addEventListener('change', function () { state.reviewed = reviewed.checked; updateApproveBtn(); });
  approveBtn.addEventListener('click', function () {
    // Único camino de envío: acción explícita de una persona, con la casilla de revisión marcada.
    if (state.approved || !reviewed.checked || !ta.value.trim()) return;
    state.text = ta.value.trim();
    state.approved = true;
    renderApproval();
    renderChat();
    live.textContent = 'Aprobado por una persona. El mensaje se envió a la prospecta ficticia.';
    done.setAttribute('tabindex', '-1');
    done.focus();
  });

  render(false);
})();
