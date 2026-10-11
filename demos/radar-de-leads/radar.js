/* Radar de Leads · demo ilustrativa. Estado simulado en el navegador, sin backend.
   Todos los datos son ficticios. El primer contacto solo se envía con la aprobación explícita de una persona. */
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
    1: 'El Captador crea una ficha única, con el canal de origen, el permiso para conversar y la respuesta sobre promociones registrados.',
    2: 'La ficha se completa con las respuestas de Laura. El Calificador muestra las señales con la frase que las respalda, la regla que se cumplió y una prioridad sugerida que una persona revisa.'
  };
  var BASE_LOG = [
    ['Captador', 'agente', 'Creó la ficha de Laura Ejemplo (origen: WhatsApp) y registró el texto del aviso mostrado.'],
    ['Asistente virtual', 'agente', 'Se presentó como asistente virtual, compartió el aviso de privacidad del negocio, ofreció pasar con una persona y pidió permiso para hacer preguntas.'],
    ['Asistente virtual', 'agente', 'Pidió por separado el consentimiento para promociones. Laura no aceptó; se guardó con fecha, canal y texto mostrado y la atención siguió igual.'],
    ['Calificador', 'agente', 'Sugirió prioridad alta con la regla que se cumplió, citando las frases de Laura. Explicación guardada. Criterios de ejemplo.'],
    ['Redactor', 'agente', 'Dejó un borrador de primer contacto en la cola de aprobación. No se envía sin una persona.']
  ];

  // Conversación ficticia: saludo con aviso y oferta de persona, permiso para conversar,
  // preguntas, y el consentimiento para promociones pedido por separado.
  var CHAT = [
    { k: 'a1', s: 1, side: 'in', who: 'Laura Ejemplo (prospecta ficticia)', text: 'Hola, buenas tardes. Quisiera que me manden una propuesta de mantenimiento para mi local.' },
    { k: 'a2', s: 1, side: 'out', who: 'Asistente virtual', text: 'Hola, soy la asistente virtual de Comercial Ejemplo. Aquí puedes ver nuestro aviso de privacidad. Si prefieres hablar con una persona, dímelo. ¿Te hago unas preguntas para que la persona indicada te atienda?', chip: 'Aviso de privacidad del negocio' },
    { k: 'a3', s: 1, side: 'in', who: 'Laura Ejemplo', text: 'Sí, adelante.' },
    { k: 'b1', s: 1, side: 'out', who: 'Asistente virtual', text: 'Gracias, Laura. ¿Qué necesitas y para cuándo?' },
    { k: 'b2', s: 1, side: 'in', who: 'Laura Ejemplo', text: 'Mantenimiento para mi local. Lo necesito pronto.' },
    { k: 'b3', s: 1, side: 'out', who: 'Asistente virtual', text: '¿Cómo prefieres que te contactemos?' },
    { k: 'b4', s: 1, side: 'in', who: 'Laura Ejemplo', text: 'Por WhatsApp, en la tarde.' },
    { k: 'c1', s: 1, side: 'out', who: 'Asistente virtual', text: 'Una pregunta aparte: ¿quieres que Comercial Ejemplo te envíe promociones por WhatsApp? Puedes decir que no y te seguimos atendiendo igual.', chip: 'Consentimiento para promociones, por separado' },
    { k: 'c2', s: 1, side: 'in', who: 'Laura Ejemplo', text: 'No, gracias.' },
    { k: 'c3', s: 1, side: 'out', who: 'Asistente virtual', text: 'Sin problema, te seguimos atendiendo igual y no recibirás mensajes comerciales. Una persona del equipo revisará tu caso. Si prefieres hablar con alguien antes, dímelo y te paso con una persona.' }
  ];

  var ORIGINAL_DRAFT = $('#draft-text').value;

  var state;
  function fresh() {
    return { step: 1, approved: false, rejected: false, editing: false, edited: false, text: ORIGINAL_DRAFT, reviewed: false, paused: false, seen: {},
      log: BASE_LOG.map(function (r) { return { who: r[0], kind: r[1], text: r[2] }; }) };
  }
  function addLog(who, kind, text) { state.log.push({ who: who, kind: kind, text: text }); } // bitácora solo acumulativa
  state = fresh();

  var stage = $('#stage'), chat = $('#chat'), live = $('#live');
  var prevBtn = $('#prev'), nextBtn = $('#next'), resetBtn = $('#reset');
  var ta = $('#draft-text'), reviewed = $('#reviewed'), approveBtn = $('#approve'), editBtn = $('#edit'), rejectBtn = $('#reject');
  var pauseBtn = $('#pause'), resumeBtn = $('#resume');
  var draft = $('#draft'), statusChip = $('#status'), done = $('#done');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ── Chat ── */
  function renderChat() {
    var items = CHAT.filter(function (m) { return m.s <= 1; }).map(function (m) { return { k: m.k, m: m }; });
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
      if (state.approved) {
        var o = el('div', 'msg msg--out');
        o.appendChild(el('span', 'msg__who', 'Valeria Ejemplo (persona del equipo)'));
        o.appendChild(el('span', 'msg__text', state.text));
        if (!state.seen.sent) o.classList.add('is-new');
        shown.sent = true;
        chat.appendChild(o);
        var s2 = el('div', 'chat__sys chat__sys--ok', 'Enviado después de la aprobación de una persona.');
        if (!state.seen.sentsys) s2.classList.add('is-new');
        s2.style.setProperty('--i', 1);
        shown.sentsys = true;
        chat.appendChild(s2);
      } else if (state.rejected) {
        var r = el('div', 'chat__sys chat__sys--rej', 'Primer contacto rechazado por una persona. No se envió nada a Laura.');
        if (!state.seen.rej) r.classList.add('is-new');
        shown.rej = true;
        chat.appendChild(r);
      } else {
        var p = el('div', 'chat__sys chat__sys--pend', 'Borrador en espera de aprobación. Nada se ha enviado a Laura.');
        if (!state.seen.pend) p.classList.add('is-new');
        shown.pend = true;
        chat.appendChild(p);
      }
      if (state.paused) {
        var q = el('div', 'chat__sys chat__sys--pend', 'Radar en pausa: no sale mensaje alguno.');
        if (!state.seen.paused) q.classList.add('is-new');
        shown.paused = true;
        chat.appendChild(q);
      }
    }
    state.seen = shown;
    chat.scrollTop = chat.scrollHeight;
  }

  /* ── Ficha ── */
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

  /* ── Aprobación ── */
  function decided() { return state.approved || state.rejected; }
  function locked() { return decided() || state.paused; }
  function renderApproval() {
    ta.value = state.text;
    ta.readOnly = locked() || !state.editing; autosize(ta);
    reviewed.checked = state.reviewed || state.approved;
    reviewed.disabled = locked();
    editBtn.disabled = locked();
    editBtn.setAttribute('aria-pressed', state.editing ? 'true' : 'false');
    editBtn.textContent = state.editing ? 'Listo con la edición' : 'Editar';
    rejectBtn.disabled = locked();
    updateApproveBtn();
    var st = state.approved ? 'approved' : state.rejected ? 'rejected' : 'pending';
    draft.setAttribute('data-state', st);
    statusChip.className = 'chip ' + (state.approved ? 'chip--ok' : state.rejected ? 'chip--rej' : 'chip--pend');
    statusChip.textContent = state.approved ? 'Aprobado por una persona' : state.rejected ? 'Rechazado, no se envía' : 'Pendiente de aprobación';
    done.hidden = !decided();
    if (state.approved) {
      done.textContent = 'Valeria Ejemplo, persona del equipo, ' + (state.edited ? 'editó y aprobó' : 'revisó y aprobó') + ' este primer contacto. Solo entonces se envió.';
    } else if (state.rejected) {
      done.textContent = 'Valeria Ejemplo, persona del equipo, rechazó este primer contacto. Rechazado, no se envía: no salió nada hacia Laura.';
    }
    $('#approve-help').textContent = state.paused
      ? 'El Radar está en pausa: las acciones de esta cola están desactivadas hasta que una persona autorizada lo reanude.'
      : 'Sin esta aprobación, el mensaje no sale. «Aprobar» se activa cuando la persona marca que revisó y termina de editar.';
  }
  function updateApproveBtn() {
    approveBtn.disabled = locked() || state.editing || !(reviewed.checked && ta.value.trim().length > 0);
  }

  /* ── Embudo y bitácora ── */
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
    if (state.paused) {
      cols[0].list.forEach(function (x) { x.lead = { n: x.lead.n, p: x.lead.p, status: 'Pasa directo a una persona', statusCls: 'chip--pend' }; });
    }
    if (state.approved) {
      cols[3].list.unshift({ lead: laura, hl: true });
    } else if (state.rejected) {
      laura.status = 'Rechazado, no se envía'; laura.statusCls = 'chip--rej';
      cols[2].list.push({ lead: laura, hl: true });
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
    var ol = $('#log');
    ol.textContent = '';
    state.log.forEach(function (r) { ol.appendChild(logRow(r.who, r.kind, r.text)); });
    // Pendientes: lista aparte, para que la bitácora solo crezca
    var pl = $('#pend');
    pl.textContent = '';
    var any = false;
    if (!decided()) {
      pl.appendChild(logRow('Valeria Ejemplo', 'pend', 'Aprobar, editar o rechazar el primer contacto. Mientras tanto, todavía no se envía mensaje alguno a Laura.')); any = true;
    }
    if (state.paused) {
      pl.appendChild(logRow('Persona autorizada', 'pend', 'Reanudar el Radar. Solo una persona autorizada puede hacerlo.')); any = true;
    }
    if (!any) pl.appendChild(logRow('Equipo', 'persona', 'Nada pendiente de aprobación por ahora.'));
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

  function renderPause() {
    var chip = $('#pause-chip');
    chip.className = 'chip ' + (state.paused ? 'chip--pend' : 'chip--ok');
    chip.textContent = state.paused ? 'En pausa' : 'Activo';
    $('#pause-text').textContent = state.paused
      ? 'En pausa: no sale mensaje alguno y los prospectos nuevos pasan directo a una persona. Solo una persona autorizada puede reanudar.'
      : 'Una persona puede pausar el Radar desde el panel. En pausa no sale mensaje alguno y los prospectos nuevos pasan directo a una persona.';
    pauseBtn.hidden = state.paused;
    resumeBtn.hidden = !state.paused;
  }

  /* ── Navegación ── */
  // El textarea crece a su contenido: nunca queda texto oculto ni barra de scroll interna.
  function autosize(t) {
    if (!t || t.offsetParent === null) return;
    t.style.height = 'auto';
    var extra = t.offsetHeight - t.clientHeight;
    t.style.height = (t.scrollHeight + extra) + 'px';
  }
  function watchSize(t) {
    var w = 0;
    function again() { autosize(t); }
    window.addEventListener('resize', again);
    window.addEventListener('load', again);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    if (window.ResizeObserver) new ResizeObserver(function () { if (t.clientWidth !== w) { w = t.clientWidth; autosize(t); } }).observe(t);
    t.addEventListener('input', again);
  }
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
    if (s === 4) { renderFunnel(); renderLog(); renderPause(); }
    $('#pausebar').hidden = !state.paused;
    stage.setAttribute('data-paused', state.paused ? 'true' : 'false');
    renderChat();
    prevBtn.disabled = s === 1;
    nextBtn.disabled = s === LAST;
    if (announce) live.textContent = STEP_NAMES[s] + (s === 3 && !decided() ? '. Hay un borrador pendiente de aprobación.' : '');
    autosize(ta);
  }
  function go(n) { state.step = Math.max(1, Math.min(LAST, n)); render(true); }

  $$('.step').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
  prevBtn.addEventListener('click', function () { go(state.step - 1); });
  nextBtn.addEventListener('click', function () { go(state.step + 1); });
  resetBtn.addEventListener('click', function () {
    var keepLog = state.log, keepPaused = state.paused;
    state = fresh();
    state.log = keepLog; state.paused = keepPaused; // la bitácora y la pausa no se borran al reiniciar
    addLog('Persona', 'persona', 'Reinició la demostración: el recorrido vuelve al inicio; la bitácora y la pausa se conservan.');
    render(false);
    live.textContent = 'Demo reiniciada. ' + STEP_NAMES[1];
  });

  ta.addEventListener('input', function () {
    state.text = ta.value;
    state.edited = ta.value.trim() !== ORIGINAL_DRAFT.trim();
    updateApproveBtn();
  });
  reviewed.addEventListener('change', function () { state.reviewed = reviewed.checked; updateApproveBtn(); });
  editBtn.addEventListener('click', function () {
    if (locked()) return;
    if (!state.editing) {
      state.editing = true;
      state.reviewed = false; // al entrar a Editar se vuelve a pedir la casilla de revisión
      renderApproval();
      ta.focus();
      live.textContent = 'Modo de edición. Cambia el mensaje y pulsa «Listo con la edición».';
    } else {
      state.editing = false;
      if (state.edited && !state.editLogged) { addLog('Valeria Ejemplo', 'persona', 'Editó el borrador del primer contacto antes de decidir.'); state.editLogged = true; }
      if (state.edited) state.reviewed = false; // si cambia el texto, se vuelve a revisar
      renderApproval();
      editBtn.focus();
      live.textContent = 'Edición terminada. Marca la casilla de revisión para poder aprobar.';
    }
  });
  rejectBtn.addEventListener('click', function () {
    if (locked()) return;
    state.rejected = true; state.editing = false;
    addLog('Valeria Ejemplo', 'persona', 'Rechazó el primer contacto. Rechazado, no se envía: no salió mensaje alguno.');
    renderApproval(); renderChat();
    live.textContent = 'Rechazado, no se envía. No salió nada hacia la prospecta ficticia.';
    done.setAttribute('tabindex', '-1');
    done.focus();
  });
  approveBtn.addEventListener('click', function () {
    // Único camino de envío: acción explícita de una persona, con la casilla de revisión marcada y sin pausa.
    if (locked() || state.editing || !reviewed.checked || !ta.value.trim()) return;
    state.text = ta.value.trim();
    state.approved = true;
    addLog('Valeria Ejemplo', 'persona', 'Revisó la prioridad sugerida y ' + (state.edited ? 'editó y aprobó' : 'aprobó') + ' el primer contacto. Solo entonces se envió (envío simulado).');
    addLog('Seguimiento', 'agente', 'Dejó un recordatorio interno para Valeria: dar el siguiente paso acordado con Laura.');
    renderApproval();
    renderChat();
    live.textContent = 'Aprobado por una persona. El mensaje se envió a la prospecta ficticia.';
    done.setAttribute('tabindex', '-1');
    done.focus();
  });
  pauseBtn.addEventListener('click', function () {
    if (state.paused) return;
    state.paused = true;
    addLog('Persona autorizada', 'persona', 'Pausó el Radar desde el panel.');
    addLog('Orquestador', 'agente', 'Aplicó la pausa: no sale mensaje alguno y los prospectos nuevos pasan directo a una persona.');
    render(false);
    resumeBtn.focus();
    live.textContent = 'Radar en pausa. Las acciones están desactivadas hasta que una persona autorizada lo reanude.';
  });
  resumeBtn.addEventListener('click', function () {
    if (!state.paused) return;
    state.paused = false;
    addLog('Persona autorizada', 'persona', 'Reanudó el Radar desde el panel.');
    addLog('Orquestador', 'agente', 'Reanudó la operación después de la indicación de la persona autorizada.');
    render(false);
    pauseBtn.focus();
    live.textContent = 'Radar reanudado por una persona autorizada.';
  });

  watchSize(ta);
  render(false);
})();
