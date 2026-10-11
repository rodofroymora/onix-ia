/* Agentes de Operación · demo ilustrativa. Todo simulado en el navegador: sin backend, sin llamadas externas, sin guardar nada.
   Datos ficticios. El borrador solo avanza con la aprobación explícita de una persona. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LAST = 5;
  var DEFAULT_NOTE = $('#quote-note').value;

  var STEP_NAMES = { 1: 'Llega un correo', 2: 'Se capturan los datos', 3: 'Borrador', 4: 'Una persona aprueba', 5: 'Bitácora y pausa' };
  var WHO = {
    1: 'Participa: el Receptor',
    2: 'Participan: el Capturista y una persona del equipo',
    3: 'Participan: la asistente que arma borradores y una persona del equipo',
    4: 'Participan: una persona del equipo y Seguimiento',
    5: 'Participan: el Orquestador y una persona del equipo'
  };
  var AGENTS = [
    { id: 'rec', name: 'Receptor de solicitudes', effect: 'las solicitudes nuevas pasan a la cola humana' },
    { id: 'cap', name: 'Capturista', effect: 'la revisión de renglones queda desactivada' },
    { id: 'cot', name: 'Asistente de borradores', effect: 'no hay borrador ni aprobación' },
    { id: 'seg', name: 'Seguimiento', effect: 'no se anotan respuestas ni se avisa al equipo' },
    { id: 'rep', name: 'Reportero', effect: 'no se preparan reportes de lectura' }
  ];
  var ROWS = {
    desk: { label: 'Escritorio', art: 'el escritorio', proposal: 'Medida estándar' },
    file: { label: 'Archivero', art: 'el archivero', proposal: 'Metálico' }
  };

  var state;
  function fresh() {
    return {
      step: 1, note: DEFAULT_NOTE, reviewed: false, editing: false, noteEdited: false,
      sent: false, rejected: false, sentNote: '', seen: {},
      rows: { desk: { d: null, v: null, editing: false }, file: { d: null, v: null, editing: false } },
      paused: { rec: false, cap: false, cot: false, seg: false, rep: false },
      draftLogged: false,
      log: [
        { who: 'Receptor', kind: 'agente', text: 'Creó la tarea “Borrador — Empresa Demo” con urgencia normal. Estado: pendiente.' },
        { who: 'Capturista', kind: 'agente', text: 'Extrajo los renglones del adjunto con su confianza (alta o baja) y marcó los dudosos como pendientes de revisión.' }
      ]
    };
  }
  state = fresh();
  function addLog(who, kind, text) { state.log.push({ who: who, kind: kind, text: text }); } // bitácora solo acumulativa

  var stage = $('#stage'), thread = $('#thread'), live = $('#live');
  var prevBtn = $('#prev'), nextBtn = $('#next'), resetBtn = $('#reset');
  var noteEl = $('#quote-note'), reviewed = $('#reviewed'), sendBtn = $('#send-btn'), editBtn = $('#edit-note'), rejectBtn = $('#reject-quote');

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function resolved() { return !!(state.rows.desk.d && state.rows.file.d); }
  function isP(id) { return state.paused[id]; }
  function anyPaused() { return AGENTS.some(function (a) { return state.paused[a.id]; }); }
  function allPaused() { return AGENTS.every(function (a) { return state.paused[a.id]; }); }
  function decided() { return state.sent || state.rejected; }
  function sendLocked() { return decided() || isP('cot'); }
  function rowsLocked() { return decided() || isP('cap'); }
  function rowText(k) {
    var r = state.rows[k];
    if (r.d === 'rejected') return 'Rechazado, no se incluye';
    return r.v;
  }

  /* ── Hilo de correos ── */
  function email(key, out, from, subj, body, att) {
    var n = el('article', 'email' + (out ? ' email--out' : ''));
    n.appendChild(el('span', 'email__from', from));
    n.appendChild(el('span', 'email__subj', subj));
    n.appendChild(el('span', null, body));
    if (att) { n.appendChild(document.createElement('br')); n.appendChild(el('span', 'email__att', att)); }
    return { key: key, node: n };
  }
  function renderThread() {
    var items = [];
    items.push(email('m1', false, 'De: Empresa Demo (cliente ficticio)', 'Solicitud de borrador', 'Hola, buenas tardes. ¿Nos pueden armar un borrador con lo que viene en la lista adjunta? Gracias.', 'Adjunto: lista-de-necesidades (ficticio)'));
    if (state.sent) {
      items.push(email('m2', true, 'De: Marisol Ejemplo (persona del equipo de Servicios Ejemplo)', 'Re: Solicitud de borrador', state.sentNote, 'Adjunto: borrador aprobado de Empresa Demo (ficticio, simulado)'));
      items.push(email('m3', false, 'De: Empresa Demo (cliente ficticio)', 'Re: Solicitud de borrador', 'Acepto el borrador. Gracias.'));
    }
    var shown = {}, idx = 0;
    thread.textContent = '';
    items.forEach(function (it) {
      if (!state.seen[it.key]) { it.node.classList.add('is-new'); it.node.style.setProperty('--i', idx++); }
      shown[it.key] = true; thread.appendChild(it.node);
    });
    function sys(key, cls, text) {
      var n = el('div', 'thread__sys ' + cls, text);
      if (!state.seen[key]) n.classList.add('is-new');
      shown[key] = true; thread.appendChild(n);
    }
    if (state.step >= 3 && !decided()) sys('sys1', 'thread__sys--pend', 'Borrador en espera de una persona. Nada se ha enviado a Empresa Demo.');
    if (state.rejected) sys('sysrej', 'thread__sys--rej', 'Borrador rechazado por una persona. Rechazado, no se envía: no salió nada hacia Empresa Demo.');
    if (state.sent) sys('sys2', 'thread__sys--ok', 'Borrador aprobado por una persona (simulado: no sale nada real).' + (isP('seg') ? ' Seguimiento está en pausa: la respuesta del cliente regresó a la cola humana.' : ' La asistente virtual solo anotó la solicitud y avisó al equipo.'));
    if (anyPaused()) sys('syspz', 'thread__sys--pend', 'Hay agentes en pausa. Las tareas pendientes regresaron a la cola humana.');
    state.seen = shown;
  }

  /* ── Captura: renglones dudosos (Aprobar / Editar / Rechazar) ── */
  var ST = { approved: ['chip--ok', 'Aprobado por una persona'], edited: ['chip--ok', 'Editado por una persona'], rejected: ['chip--rej', 'Rechazado, no se incluye'] };
  function renderCapture() {
    var lock = rowsLocked();
    Object.keys(ROWS).forEach(function (k) {
      var r = state.rows[k];
      var st = $('#st-' + k);
      if (r.d) { st.className = 'chip ' + ST[r.d][0]; st.textContent = ST[r.d][1] + (r.d === 'edited' ? ': ' + r.v : ''); }
      else { st.className = 'chip chip--gap'; st.textContent = 'Pendiente de revisar'; }
      $('#edit-' + k).hidden = !r.editing;
      $('[data-act="edit"][data-row="' + k + '"]').setAttribute('aria-expanded', String(r.editing));
      $$('input[name="' + k + '"]').forEach(function (i) { i.checked = r.d === 'edited' && r.v === i.value; i.disabled = lock; });
      $$('[data-row="' + k + '"]').forEach(function (b) { if (b.tagName === 'BUTTON') b.disabled = lock; });
    });
    var note = $('#resolve-note');
    if (isP('cap')) note.textContent = 'El Capturista está en pausa: la revisión de renglones queda desactivada hasta que una persona autorizada lo reanude.';
    else if (decided()) note.textContent = 'El borrador ya tiene una decisión: los renglones quedan cerrados.';
    else if (resolved()) note.textContent = 'Listo: una persona decidió sobre los renglones dudosos. Ahora la asistente que arma borradores puede prepararlo.';
    else note.textContent = 'Decide cada renglón dudoso (aprobar, editar o rechazar) para continuar. En un proyecto real, la persona responsable resuelve estos renglones.';
  }
  function decideRow(k, d, v) {
    if (rowsLocked()) return;
    var r = state.rows[k];
    r.d = d; r.v = v; r.editing = false;
    var verb = d === 'approved' ? 'aprobó la propuesta de la asistente virtual para ' : d === 'edited' ? 'editó el renglón de ' : 'rechazó el renglón de ';
    addLog('Marisol Ejemplo', 'persona', 'Marisol ' + verb + ROWS[k].art.replace(/^el /, 'el ') + (d === 'edited' ? ': ' + v + '.' : d === 'rejected' ? '. Rechazado, no se incluye en el borrador.' : '.'));
    if (resolved() && !state.draftLogged) {
      state.draftLogged = true;
      addLog('Asistente de borradores', 'agente', 'Armó el borrador y lo dejó en la cola del equipo. Estado: pendiente. No lo comparte con el cliente.');
    }
    renderCapture();
    live.textContent = ST[d][1] + '.';
  }

  /* ── Borrador ── */
  function row(a, b, c, cls) {
    var r = el('div', 'tbl__row' + (cls ? ' ' + cls : ''));
    r.setAttribute('role', 'row');
    [a, b, c].forEach(function (t, i) { var s = el('span', i === 0 ? 'tbl__item' : 'tbl__detail', t); s.setAttribute('role', cls === 'tbl__row--head' ? 'columnheader' : 'cell'); r.appendChild(s); });
    return r;
  }
  function blockedMsg(where) {
    if (isP('cot')) return 'La asistente de borradores está en pausa: no hay borrador ni envío. La tarea regresó a la cola humana hasta que una persona autorizada lo reanude.';
    if (!resolved()) return where === 3
      ? 'Borrador en espera: faltan renglones dudosos por decidir. Vuelve al paso anterior para que una persona los resuelva.'
      : 'Aún no hay borrador para aprobar: faltan renglones dudosos por decidir en el paso de captura de datos.';
    return '';
  }
  function renderQuote() {
    var msg = blockedMsg(3), ok = !msg;
    var b = $('#v3-blocked'); b.hidden = ok; b.textContent = msg;
    $('#quote').hidden = !ok;
    var t = $('#quote-tbl'); t.textContent = '';
    t.appendChild(row('Concepto', 'Detalle', 'Importe', 'tbl__row--head'));
    t.appendChild(row('Silla ergonómica', 'Con respaldo ajustable', 'Lo define tu equipo'));
    if (resolved()) {
      ['desk', 'file'].forEach(function (k) { t.appendChild(row(ROWS[k].label, rowText(k), state.rows[k].d === 'rejected' ? '—' : 'Lo define tu equipo', state.rows[k].d === 'rejected' ? 'tbl__row--rej' : '')); });
    }
    t.appendChild(row('Lámpara de escritorio', 'Luz cálida', 'Lo define tu equipo'));
    $('#note-view').textContent = state.note;
    var qs = $('#quote-status');
    qs.className = 'chip ' + (state.sent ? 'chip--ok' : state.rejected ? 'chip--rej' : 'chip--pend');
    qs.textContent = state.sent ? 'Borrador aprobado por una persona' : state.rejected ? 'Rechazado, no se envía' : 'Borrador · no se envía solo';
  }

  /* ── Decisión de la persona ── */
  function updateSendBtn() { sendBtn.disabled = sendLocked() || state.editing || !(resolved() && reviewed.checked && noteEl.value.trim().length > 0); }
  function renderSend() {
    var msg = blockedMsg(4), ok = !msg;
    var b = $('#v4-blocked'); b.hidden = ok; b.textContent = msg;
    $('#send').hidden = !ok;
    var lock = sendLocked();
    noteEl.value = state.note;
    noteEl.readOnly = lock || !state.editing;
    reviewed.checked = state.reviewed || state.sent;
    reviewed.disabled = lock;
    editBtn.disabled = lock; rejectBtn.disabled = lock;
    editBtn.setAttribute('aria-pressed', String(state.editing));
    editBtn.textContent = state.editing ? 'Listo con la edición' : 'Editar';
    updateSendBtn();
    var box = $('#send');
    box.setAttribute('data-state', state.sent ? 'approved' : state.rejected ? 'rejected' : 'pending');
    var st = $('#send-status');
    st.className = 'chip ' + (state.sent ? 'chip--ok' : state.rejected ? 'chip--rej' : 'chip--pend');
    st.textContent = state.sent ? 'Borrador aprobado por una persona' : state.rejected ? 'Rechazado, no se envía' : 'Pendiente de aprobación por una persona';
    $('#after').hidden = !state.sent;
    $('#gate').hidden = decided(); $('#send-help').hidden = decided();
    var rd = $('#rej-done'); rd.hidden = !state.rejected;
    if (state.rejected) rd.textContent = 'Marisol Ejemplo, persona del equipo, rechazó este borrador. Rechazado, no se envía: no salió nada hacia Empresa Demo.';
    if (state.sent) {
      $('#sent-done').textContent = 'Marisol Ejemplo, persona del equipo, revisó, ajustó y aprobó el borrador. Ella lo comparte desde su propio correo (simulado en esta demo).' + (isP('seg') ? '' : ' Cuando Empresa Demo respondió que acepta, la asistente virtual anotó la solicitud y la mandó al equipo.');
      $('#wa-prev').hidden = isP('seg'); $('#seg-paused').hidden = !isP('seg');
    }
    $('#send-help').textContent = isP('cot')
      ? 'La asistente de borradores está en pausa: las acciones de aprobación están desactivadas hasta que una persona autorizada lo reanude.'
      : 'Sin esta aprobación, el borrador no avanza. «Aprobar borrador» se activa cuando la persona marca que revisó y termina de editar.';
  }

  /* ── Bitácora y pausa ── */
  function logRow(who, kind, text) {
    var li = el('li'); var a = el('div', 'log__actor'); a.appendChild(el('span', null, who));
    if (kind === 'persona') a.appendChild(el('span', 'chip chip--persona', 'Persona'));
    else if (kind === 'pend') a.appendChild(el('span', 'chip chip--pend', 'Pendiente'));
    else a.appendChild(el('span', 'chip chip--agente', 'Automatizado'));
    li.appendChild(a); li.appendChild(el('span', null, text));
    if (kind === 'pend') li.classList.add('is-pending');
    return li;
  }
  function renderLogAndAgents() {
    var ul = $('#agents'); ul.textContent = '';
    AGENTS.forEach(function (a) {
      var p = isP(a.id);
      var li = el('li');
      var left = el('span', 'agents__name', a.name);
      left.appendChild(el('span', 'chip ' + (p ? 'chip--pend' : 'chip--ok'), p ? 'En pausa' : 'Activo'));
      if (p) left.appendChild(el('span', 'agents__effect', 'Efecto: ' + a.effect + '.'));
      li.appendChild(left);
      var b = el('button', 'btn btn--ghost btn--sm', p ? 'Reanudar (persona autorizada)' : 'Pausar');
      b.type = 'button'; b.setAttribute('data-agent', a.id); b.setAttribute('data-do', p ? 'resume' : 'pause');
      b.setAttribute('aria-label', (p ? 'Reanudar ' : 'Pausar ') + a.name + (p ? ' (persona autorizada)' : ''));
      li.appendChild(b);
      ul.appendChild(li);
    });
    $('#pause-all').hidden = allPaused();
    $('#resume-all').hidden = !anyPaused();
    var ol = $('#log'); ol.textContent = '';
    state.log.forEach(function (r) { ol.appendChild(logRow(r.who, r.kind, r.text)); });
    var pl = $('#pend'); pl.textContent = '';
    var any = false;
    if (!resolved() && !decided()) { pl.appendChild(logRow('Marisol Ejemplo', 'pend', 'Decidir los renglones dudosos. Mientras tanto, no hay borrador.')); any = true; }
    else if (!decided()) { pl.appendChild(logRow('Marisol Ejemplo', 'pend', 'Aprobar, editar o rechazar el borrador. Mientras tanto, no se ha enviado nada al cliente.')); any = true; }
    if (state.sent) { pl.appendChild(logRow('Equipo de Servicios Ejemplo', 'pend', 'Confirmar el pedido en sus propios sistemas. Aún no ocurre en esta demo.')); any = true; }
    AGENTS.forEach(function (a) { if (isP(a.id)) { pl.appendChild(logRow('Persona autorizada', 'pend', 'Reanudar: ' + a.name + '. Solo una persona autorizada puede hacerlo.')); any = true; } });
    if (!any) pl.appendChild(logRow('Equipo', 'persona', 'Nada pendiente por ahora.'));
  }
  function setPaused(ids, value) {
    var changed = ids.filter(function (id) { return state.paused[id] !== value; });
    if (!changed.length) return;
    var names = changed.map(function (id) { return AGENTS.filter(function (a) { return a.id === id; })[0]; });
    var list = names.length === AGENTS.length ? 'todos los agentes' : names.map(function (a) { return a.name; }).join(', ');
    changed.forEach(function (id) { state.paused[id] = value; });
    if (value) {
      addLog('Persona autorizada', 'persona', 'Pausó desde el panel: ' + list + '.');
      addLog('Orquestador', 'agente', 'Aplicó la pausa en ' + list + '. Las tareas pendientes regresaron a la cola humana y las acciones de ese paso quedaron desactivadas.');
    } else {
      addLog('Persona autorizada', 'persona', 'Reanudó desde el panel: ' + list + '.');
      addLog('Orquestador', 'agente', 'Reanudó ' + list + ' por indicación de la persona autorizada.');
    }
    render(false);
    live.textContent = (value ? 'En pausa: ' : 'Reanudado: ') + list + '.';
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
    $$('.view').forEach(function (v) { v.hidden = Number(v.getAttribute('data-view')) !== s; });
    $('#who').textContent = WHO[s];
    var pb = $('#pausebar');
    pb.hidden = !anyPaused();
    if (anyPaused()) {
      var ps = AGENTS.filter(function (a) { return isP(a.id); });
      pb.textContent = (allPaused() ? 'Todos los agentes en pausa.' : 'En pausa: ' + ps.map(function (a) { return a.name; }).join(', ') + '.') + ' Las tareas pendientes regresaron a la cola humana. ' +
        ps.map(function (a) { return a.name + ': ' + a.effect; }).join('; ') + '.';
    }
    $('#rec-paused').hidden = !isP('rec');
    if (s === 2) renderCapture();
    if (s === 3) renderQuote();
    if (s === 4) renderSend();
    if (s === 5) renderLogAndAgents();
    renderThread();
    prevBtn.disabled = s === 1;
    nextBtn.disabled = s === LAST;
    if (announce) live.textContent = STEP_NAMES[s] + (s === 4 && resolved() && !decided() ? '. El borrador espera a una persona.' : '');
  }
  function go(n) { state.step = Math.max(1, Math.min(LAST, n)); render(true); }

  $$('.step').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
  prevBtn.addEventListener('click', function () { go(state.step - 1); });
  nextBtn.addEventListener('click', function () { go(state.step + 1); });
  resetBtn.addEventListener('click', function () {
    var keepLog = state.log, keepPaused = state.paused;
    state = fresh(); noteEl.value = DEFAULT_NOTE;
    state.log = keepLog; state.paused = keepPaused; // bitácora y pausas no se borran al reiniciar
    addLog('Persona', 'persona', 'Reinició la demostración: el recorrido vuelve al inicio; la bitácora y las pausas se conservan.');
    render(false); live.textContent = 'Demo reiniciada. ' + STEP_NAMES[1];
  });

  // Renglones dudosos
  $$('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-row'), act = b.getAttribute('data-act');
      if (rowsLocked()) return;
      if (act === 'approve') decideRow(k, 'approved', ROWS[k].proposal);
      else if (act === 'reject') decideRow(k, 'rejected', null);
      else { state.rows[k].editing = !state.rows[k].editing; renderCapture(); if (state.rows[k].editing) { var f = $('input[name="' + k + '"]'); if (f) f.focus(); } }
    });
  });
  $$('input[name="desk"], input[name="file"]').forEach(function (r) {
    r.addEventListener('change', function () {
      decideRow(r.name, 'edited', r.value);
      var eb = $('[data-act="edit"][data-row="' + r.name + '"]'); if (eb && !eb.disabled) eb.focus(); // el foco vuelve al botón Editar del renglón
    });
  });

  // Envío por una persona
  noteEl.addEventListener('input', function () { state.note = noteEl.value; state.noteEdited = state.note.trim() !== DEFAULT_NOTE.trim(); updateSendBtn(); });
  reviewed.addEventListener('change', function () { state.reviewed = reviewed.checked; updateSendBtn(); });
  editBtn.addEventListener('click', function () {
    if (sendLocked()) return;
    if (!state.editing) { state.editing = true; state.reviewed = false; renderSend(); noteEl.focus(); live.textContent = 'Modo de edición. Ajusta las notas y pulsa «Listo con la edición».'; }
    else {
      state.editing = false;
      if (state.noteEdited && !state.noteLogged) { addLog('Marisol Ejemplo', 'persona', 'Editó las notas del borrador antes de decidir.'); state.noteLogged = true; }
      if (state.noteEdited) state.reviewed = false;
      renderSend(); editBtn.focus();
      live.textContent = 'Edición terminada. Marca la casilla de revisión para poder aprobar.';
    }
  });
  rejectBtn.addEventListener('click', function () {
    if (sendLocked()) return;
    state.rejected = true; state.editing = false;
    addLog('Marisol Ejemplo', 'persona', 'Rechazó el borrador. Estado: pendiente → rechazado. Rechazado, no se envía: no salió nada hacia el cliente.');
    renderSend(); renderThread();
    live.textContent = 'Rechazado, no se envía. No salió nada hacia el cliente ficticio.';
    var d = $('#rej-done'); d.focus();
  });
  sendBtn.addEventListener('click', function () {
    // Único camino de envío: acción explícita de una persona, con la casilla de revisión marcada y sin pausa.
    if (sendLocked() || state.editing || !resolved() || !reviewed.checked || !state.note.trim()) return;
    state.sent = true; state.sentNote = state.note.trim();
    addLog('Marisol Ejemplo', 'persona', 'Revisó, ' + (state.noteEdited ? 'editó, ' : '') + 'aprobó el borrador. Estado: pendiente → aprobado. La persona lo comparte desde su propio correo (fuera de esta demo).');
    if (isP('seg')) addLog('Seguimiento', 'agente', 'En pausa: no anotó la respuesta del cliente ni avisó al equipo. La tarea regresó a la cola humana.');
    else addLog('Seguimiento', 'agente', 'Anotó que el cliente aceptó, avisó al equipo por WhatsApp interno y dejó un recordatorio de los siguientes pasos.');
    if (isP('rep')) addLog('Reportero', 'agente', 'En pausa: no incluyó el movimiento en el reporte.');
    else addLog('Reportero', 'agente', 'Incluirá el movimiento en el resumen periódico (reporte de lectura).');
    renderSend(); renderThread();
    live.textContent = 'Borrador aprobado por una persona. El cliente ficticio respondió que acepta (simulado).';
    var d = $('#sent-done'); d.focus();
  });

  // Pausa por agente y total; Reanudar solo por persona autorizada
  $('#agents').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-agent]'); if (!b) return;
    var id = b.getAttribute('data-agent');
    setPaused([id], b.getAttribute('data-do') === 'pause');
    var nb = $('button[data-agent="' + id + '"]'); if (nb) nb.focus();
  });
  $('#pause-all').addEventListener('click', function () { setPaused(AGENTS.map(function (a) { return a.id; }), true); $('#resume-all').focus(); });
  $('#resume-all').addEventListener('click', function () { setPaused(AGENTS.map(function (a) { return a.id; }), false); $('#pause-all').focus(); });

  render(false);
})();
