/* Demo · Contabilidad Asistida — ilustrativa, con datos ficticios.
   No envía ni guarda nada: todo ocurre en esta pestaña y se pierde al recargar. */
(function () {
  'use strict';

  /* ── Pasos ───────────────────────────────────────────────── */
  var rail = document.getElementById('dca-rail');
  var tabs = rail ? [].slice.call(rail.querySelectorAll('button')) : [];
  var panels = [].slice.call(document.querySelectorAll('.dca-panel'));
  var nombre = document.getElementById('dca-win-name');

  function mostrar(i) {
    tabs.forEach(function (t, n) {
      var activo = n === i;
      t.setAttribute('aria-selected', activo ? 'true' : 'false');
      t.tabIndex = activo ? 0 : -1;
    });
    panels.forEach(function (p, n) { p.hidden = n !== i; });
    if (nombre && tabs[i]) nombre.textContent = nombre.dataset.base + ' · ' + tabs[i].dataset.win;
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { mostrar(i); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = (i + d + tabs.length) % tabs.length;
      tabs[n].focus();
      mostrar(n);
    });
  });
  if (tabs.length) mostrar(0);

  /* ── Paso 2 · una persona confirma lo que salió con baja confianza ── */
  var confirmar = document.getElementById('dca-confirmar');
  if (confirmar) {
    confirmar.addEventListener('click', function () {
      [].slice.call(document.querySelectorAll('.dca-table tr[data-rev="si"]')).forEach(function (tr) {
        tr.dataset.rev = 'no';
        var celda = tr.querySelector('.dca-state');
        if (celda) {
          celda.className = 'dca-state dca-state--ok';
          celda.innerHTML = '<i></i>Confirmado por una persona';
        }
      });
      confirmar.disabled = true;
      var aviso = document.getElementById('dca-confirmado');
      if (aviso) aviso.hidden = false;
    });
  }

  /* ── Paso 4 · asistente virtual de consultas ─────────────── */
  var chat = document.getElementById('dca-chat');
  var campo = document.getElementById('dca-pregunta');
  var form = document.getElementById('dca-form');

  /* Regla dura de la spec: toda pregunta fiscal se remite al contador, sin orientar. */
  var FISCAL = /impuest|iva|isr|sat|deduc|declaraci|retenci|contribu|fiscal|cfdi|factura electr/i;

  var RESPUESTAS = [
    {
      re: /falta|faltan|pendiente/i,
      html: 'Del expediente de este mes faltan dos comprobantes: uno del movimiento del día 12 y uno del día 27.' +
            '<span class="dca-msg__ref">Referencia: papel de trabajo del mes, renglones 4 y 7.</span>'
    },
    {
      re: /duplicad|repetid/i,
      html: 'Encontré un comprobante duplicado de Proveedor Ejemplo y lo dejé fuera del expediente.' +
            '<span class="dca-msg__ref">Referencia: expediente del mes, folio FOLIO-XXXX.</span>'
    },
    {
      re: /cu[áa]nto|total|suma|importe/i,
      html: 'El expediente de este mes tiene 14 comprobantes registrados y 2 movimientos sin comprobante.' +
            '<span class="dca-msg__ref">Referencia: reporte administrativo del mes (qué llegó, qué falta).</span>'
    }
  ];

  function burbuja(clase, html) {
    var p = document.createElement('p');
    p.className = 'dca-msg ' + clase;
    p.innerHTML = html;
    chat.appendChild(p);
    p.scrollIntoView({ block: 'nearest' });
  }

  function responder(texto) {
    if (FISCAL.test(texto)) {
      burbuja('dca-msg--in',
        'Esa pregunta la resuelve tu contador. Yo no doy orientación en materia fiscal.' +
        '<span class="dca-msg__esc">Te paso con una persona de administración para que lo canalice con el C.P. Demo.</span>');
      return;
    }
    for (var i = 0; i < RESPUESTAS.length; i++) {
      if (RESPUESTAS[i].re.test(texto)) { burbuja('dca-msg--in', RESPUESTAS[i].html); return; }
    }
    burbuja('dca-msg--in',
      'En el expediente de este mes no encuentro con qué responder eso, así que no lo voy a suponer.' +
      '<span class="dca-msg__esc">Lo escalo a administración para que lo revise una persona.</span>');
  }

  function preguntar(texto) {
    if (!chat || !texto.trim()) return;
    burbuja('dca-msg--out', texto.replace(/</g, '&lt;'));
    window.setTimeout(function () { responder(texto); }, 420);
  }

  [].slice.call(document.querySelectorAll('.dca-quick button')).forEach(function (b) {
    b.addEventListener('click', function () { preguntar(b.textContent.trim()); });
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      preguntar(campo.value);
      campo.value = '';
    });
  }
})();
