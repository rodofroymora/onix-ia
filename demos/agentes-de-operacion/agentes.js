/* Agentes de Operación · demo ilustrativa. Todo simulado en el navegador: sin backend, sin llamadas externas, sin guardar nada.
   Datos ficticios. La cotización NUNCA se envía sin la acción explícita de una persona. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LAST = 5;
  var DEFAULT_NOTE = $('#quote-note').value;

  var STEP_NAMES = { 1: 'Llega un correo', 2: 'Se capturan los datos', 3: 'Borrador de cotización', 4: 'Una persona envía', 5: 'Bitácora y pausa' };
  var WHO = {
    1: 'Participa: el Receptor',
    2: 'Participan: el Capturista y una persona del equipo',
    3: 'Participan: el Cotizador y una persona del equipo',
    4: 'Participan: una persona del equipo y el agente de Seguimiento',
    5: 'Participan: el Orquestador y una persona del equipo'
  };
  var AGENTS = ['Receptor de solicitudes', 'Capturista', 'Cotizador (borradores)', 'Seguimiento', 'Reportero'];

  function fresh() { return { step: 1, desk: null, file: null, note: DEFAULT_NOTE, reviewed: false, sent: false, sentNote: '', paused: false, seen: {} }; }
  var state = fresh();

  var stage = $('#stage'), thread = $('#thread'), live = $('#live');
  var prevBtn = $('#prev'), nextBtn = $('#next'), resetBtn = $('#reset');
  var noteEl = $('#quote-note'), reviewed = $('#reviewed'), sendBtn = $('#send-btn');

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function resolved() { return !!(state.desk && state.file); }

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
    items.push(email('m1', false, 'De: Empresa Demo (cliente ficticio)', 'Solicitud de cotización', 'Hola, buenas tardes. ¿Nos pueden cotizar lo que viene en la lista adjunta? Gracias.', 'Adjunto: lista-de-necesidades (ficticio)'));
    if (state.sent) {
      items.push(email('m2', true, 'De: Marisol Ejemplo (persona del equipo de Servicios Ejemplo)', 'Re: Solicitud de cotización', state.sentNote, 'Adjunto: cotización de Empresa Demo (ficticia)'));
      items.push(email('m3', false, 'De: Empresa Demo (cliente ficticio)', 'Re: Solicitud de cotización', 'Acepto la cotización. Gracias.'));
    }
    var shown = {}, idx = 0;
    thread.textContent = '';
    items.forEach(function (it) {
      if (!state.seen[it.key]) { it.node.classList.add('is-new'); it.node.style.setProperty('--i', idx++); }
      shown[it.key] = true; thread.appendChild(it.node);
    });
    var sys;
    if (state.step >= 3 && !state.sent) {
      sys = el('div', 'thread__sys thread__sys--pend', 'Borrador en espera de una persona. Nada se ha enviado a Empresa Demo.');
      if (!state.seen.sys1) sys.classList.add('is-new'); shown.sys1 = true; thread.appendChild(sys);
    } else if (state.sent) {
      sys = el('div', 'thread__sys thread__sys--ok', 'Cotización enviada por una persona. El agente solo anotó la solicitud y avisó al equipo.');
      if (!state.seen.sys2) sys.classList.add('is-new'); shown.sys2 = true; thread.appendChild(sys);
    }
    state.seen = shown;
  }

  /* ── Paso dos: renglones dudosos ── */
  function renderCapture() {
    ['desk', 'file'].forEach(function (k) {
      $$('input[name="' + k + '"]').forEach(function (r) { r.checked = state[k] === r.value; });
      var st = $('#st-' + k);
      st.className = 'chip ' + (state[k] ? 'chip--ok' : 'chip--gap');
      st.textContent = state[k] ? 'Resuelto por una persona' : 'Pendiente de revisión';
    });
    $('#resolve-note').textContent = resolved()
      ? 'Listo: una persona resolvió los renglones dudosos. Ahora el Cotizador puede armar el borrador.'
      : 'Elige una opción en cada renglón dudoso para continuar. En un proyecto real, la persona responsable resuelve estos renglones.';
  }

  /* ── Paso tres: borrador ── */
  function row(a, b, c, cls) {
    var r = el('div', 'tbl__row' + (cls ? ' ' + cls : ''));
    r.setAttribute('role', 'row');
    [a, b, c].forEach(function (t, i) { var s = el('span', i === 0 ? 'tbl__item' : 'tbl__detail', t); s.setAttribute('role', cls === 'tbl__row--head' ? 'columnheader' : 'cell'); r.appendChild(s); });
    return r;
  }
  function renderQuote() {
    var ok = resolved();
    $('#v3-blocked').hidden = ok;
    $('#quote').hidden = !ok;
    var t = $('#quote-tbl'); t.textContent = '';
    t.appendChild(row('Concepto', 'Detalle', 'Importe', 'tbl__row--head'));
    t.appendChild(row('Silla ergonómica', 'Con respaldo ajustable', 'Lo define tu equipo'));
    t.appendChild(row('Escritorio', state.desk || '', 'Lo define tu equipo'));
    t.appendChild(row('Archivero', state.file || '', 'Lo define tu equipo'));
    t.appendChild(row('Lámpara de escritorio', 'Luz cálida', 'Lo define tu equipo'));
    noteEl.value = state.note;
    noteEl.readOnly = state.sent;
    var qs = $('#quote-status');
    qs.className = 'chip ' + (state.sent ? 'chip--ok' : 'chip--pend');
    qs.textContent = state.sent ? 'Enviada por una persona' : 'Borrador · no se envía solo';
  }

  /* ── Paso cuatro: envío por una persona ── */
  function updateSendBtn() { sendBtn.disabled = state.sent || !(resolved() && reviewed.checked && noteEl.value.trim().length > 0); }
  function renderSend() {
    var ok = resolved();
    $('#v4-blocked').hidden = ok;
    $('#send').hidden = !ok;
    reviewed.checked = state.reviewed || state.sent;
    reviewed.disabled = state.sent;
    updateSendBtn();
    var box = $('#send');
    box.setAttribute('data-state', state.sent ? 'approved' : 'pending');
    var st = $('#send-status');
    st.className = 'chip ' + (state.sent ? 'chip--ok' : 'chip--pend');
    st.textContent = state.sent ? 'Enviada por una persona' : 'Pendiente de envío por una persona';
    $('#after').hidden = !state.sent;
    $('#gate').hidden = state.sent; $('#send-help').hidden = state.sent;
    if (state.sent) $('#sent-done').textContent = 'Marisol Ejemplo, persona del equipo, revisó, ajustó y envió la cotización desde su propio correo. Cuando Empresa Demo respondió que acepta, el agente anotó la solicitud y la mandó al equipo.';
  }

  /* ── Paso cinco: bitácora y pausa ── */
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
    AGENTS.forEach(function (n) {
      var li = el('li', null, n);
      li.appendChild(el('span', 'chip ' + (state.paused ? 'chip--pend' : 'chip--ok'), state.paused ? 'En pausa' : 'Activo'));
      ul.appendChild(li);
    });
    var pb = $('#pause');
    pb.textContent = state.paused ? 'Reanudar' : 'Pausar';
    pb.className = 'btn ' + (state.paused ? 'btn--resume' : 'btn--danger');
    pb.setAttribute('aria-pressed', String(state.paused));
    var ol = $('#log'); ol.textContent = '';
    ol.appendChild(logRow('Receptor', 'agente', 'Creó la tarea “Cotización — Empresa Demo” con urgencia normal.'));
    ol.appendChild(logRow('Capturista', 'agente', 'Extrajo los renglones del adjunto y marcó los dudosos como pendientes de revisión.'));
    if (resolved()) {
      ol.appendChild(logRow('Marisol Ejemplo', 'persona', 'Resolvió los renglones dudosos: escritorio y archivero.'));
      ol.appendChild(logRow('Cotizador', 'agente', 'Armó el borrador de la cotización y lo dejó en la cola del equipo. No lo envió.'));
    } else {
      ol.appendChild(logRow('Marisol Ejemplo', 'pend', 'Resolver los renglones dudosos. Mientras tanto, no hay borrador.'));
    }
    if (state.sent) {
      ol.appendChild(logRow('Marisol Ejemplo', 'persona', 'Revisó, ajustó y envió la cotización desde su propio correo.'));
      ol.appendChild(logRow('Seguimiento', 'agente', 'Anotó que el cliente aceptó, avisó al equipo por WhatsApp interno y dejó un recordatorio de los siguientes pasos.'));
      ol.appendChild(logRow('Reportero', 'agente', 'Incluirá el movimiento en el resumen periódico (reporte de lectura).'));
      ol.appendChild(logRow('Equipo de Servicios Ejemplo', 'pend', 'Confirmar el pedido en sus propios sistemas. Aún no ocurre en esta demo.'));
    } else if (resolved()) {
      ol.appendChild(logRow('Marisol Ejemplo', 'pend', 'Revisar y enviar la cotización. Mientras tanto, no se ha enviado nada al cliente.'));
    }
    if (state.paused) ol.appendChild(logRow('Orquestador', 'agente', 'Pausó a todos los agentes desde el panel. Las tareas pendientes regresaron a la cola humana.'));
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
    $('#pausebar').hidden = !state.paused;
    if (s === 2) renderCapture();
    if (s === 3) renderQuote();
    if (s === 4) renderSend();
    if (s === 5) renderLogAndAgents();
    renderThread();
    prevBtn.disabled = s === 1;
    nextBtn.disabled = s === LAST;
    if (announce) live.textContent = STEP_NAMES[s] + (s === 4 && resolved() && !state.sent ? '. La cotización espera a una persona.' : '');
  }
  function go(n) { state.step = Math.max(1, Math.min(LAST, n)); render(true); }

  $$('.step').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-go'))); }); });
  prevBtn.addEventListener('click', function () { go(state.step - 1); });
  nextBtn.addEventListener('click', function () { go(state.step + 1); });
  resetBtn.addEventListener('click', function () { state = fresh(); noteEl.value = DEFAULT_NOTE; render(false); live.textContent = 'Demo reiniciada. ' + STEP_NAMES[1]; });

  $$('input[name="desk"], input[name="file"]').forEach(function (r) {
    r.addEventListener('change', function () { state[r.name] = r.value; renderCapture(); live.textContent = 'Una persona resolvió un renglón dudoso.'; });
  });
  noteEl.addEventListener('input', function () { state.note = noteEl.value; });
  reviewed.addEventListener('change', function () { state.reviewed = reviewed.checked; updateSendBtn(); });
  sendBtn.addEventListener('click', function () {
    // Único camino de envío: acción explícita de una persona, con la casilla de revisión marcada.
    if (state.sent || !resolved() || !reviewed.checked || !state.note.trim()) return;
    state.sent = true; state.sentNote = state.note.trim();
    renderSend(); renderThread();
    live.textContent = 'Cotización enviada por una persona. El cliente ficticio respondió que acepta.';
    var d = $('#sent-done'); d.focus();
  });
  $('#pause').addEventListener('click', function () {
    state.paused = !state.paused; render(false);
    live.textContent = state.paused ? 'Agentes en pausa. Las tareas pendientes regresaron a la cola humana.' : 'Agentes reanudados.';
  });

  render(false);
})();
