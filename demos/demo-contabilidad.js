/* Demostración · Contabilidad Asistida.
   El scroll conduce la narración: cada paso enciende su escena en el panel.
   Datos ficticios. No se envía ni se guarda nada. */
(function () {
  'use strict';

  var pasos   = [].slice.call(document.querySelectorAll('.dc-step'));
  var escenas = [].slice.call(document.querySelectorAll('.dc-scene'));
  var titulo  = document.getElementById('dc-titulo');

  var TITULOS = {
    '1': 'Negocio Ejemplo · Expediente del mes',
    '2': 'Negocio Ejemplo · Lectura de comprobantes',
    '3': 'Negocio Ejemplo · Movimientos y comprobantes',
    '4': 'Negocio Ejemplo · Asistente virtual'
  };

  function encender(n) {
    escenas.forEach(function (s) { s.classList.toggle('on', s.id === 'dc-e' + n); });
    pasos.forEach(function (p) { p.classList.toggle('on', p.dataset.escena === n); });
    if (titulo && TITULOS[n]) titulo.textContent = TITULOS[n];
  }

  /* Sin IntersectionObserver (o con JS a medias) todo queda legible:
     las escenas se apilan y el panel muestra la primera. */
  if ('IntersectionObserver' in window && pasos.length) {
    var io = new IntersectionObserver(function (entradas) {
      var mejor = null;
      entradas.forEach(function (e) {
        if (e.isIntersecting && (!mejor || e.intersectionRatio > mejor.intersectionRatio)) mejor = e;
      });
      if (mejor) encender(mejor.target.dataset.escena);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .2, .6, 1] });
    pasos.forEach(function (p) { io.observe(p); });
    encender('1');
  }

  /* ── Asistente virtual ─────────────────────────────────────────────
     Regla dura de la spec: toda pregunta de materia fiscal se remite al
     contador, sin orientación. El patrón "deduc" cubre deducible,
     deducir y deducción sin escribir la palabra prohibida. */
  var FISCAL = /impuest|iva|isr|sat|deduc|declaraci|retenci|contribu|fiscal|cfdi|factura electr/i;

  var RESPUESTAS = [
    { re: /duplicad|repetid/i,
      html: 'Sí: un ticket de Proveedor Ejemplo llegó dos veces y quedó fuera del expediente.' +
            '<small>Expediente del mes, FOLIO-XXXX.</small>' },
    { re: /cu[áa]nt|total|llegaron|number|n[úu]mero/i,
      html: 'Este mes llegaron 14 comprobantes y hay 2 movimientos sin comprobante.' +
            '<small>Reporte administrativo del mes: qué llegó y qué falta.</small>' },
    { re: /falta|pendiente/i,
      html: 'Faltan dos: el del movimiento del día 12 y el del día 27.' +
            '<small>Según el cruce del mes, renglones 4 y 7.</small>' }
  ];

  var chat  = document.getElementById('dc-chat');
  var form  = document.getElementById('dc-form');
  var campo = document.getElementById('dc-q');
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burbuja(clase, html) {
    var p = document.createElement('p');
    p.className = 'dc-msg ' + clase;
    p.innerHTML = html;
    chat.appendChild(p);
    p.scrollIntoView({ block: 'nearest', behavior: quieto ? 'auto' : 'smooth' });
    return p;
  }

  function responder(texto) {
    if (FISCAL.test(texto)) {
      burbuja('dc-msg--in esc',
        'Esa la resuelve tu contador. Yo no doy orientación en materia fiscal.' +
        '<small>Te paso con administración para que lo canalice con el C.P. Demo.</small>');
      return;
    }
    for (var i = 0; i < RESPUESTAS.length; i++) {
      if (RESPUESTAS[i].re.test(texto)) { burbuja('dc-msg--in', RESPUESTAS[i].html); return; }
    }
    burbuja('dc-msg--in esc',
      'En el expediente de este mes no encuentro con qué responder eso, así que no lo voy a suponer.' +
      '<small>Lo escalo a administración para que lo revise una persona.</small>');
  }

  function preguntar(texto) {
    if (!chat || !texto.trim()) return;
    burbuja('dc-msg--out', texto.replace(/[<>]/g, ''));
    if (quieto) { responder(texto); return; }
    var esperando = burbuja('dc-msg--in',
      '<span class="dc-esc" aria-label="escribiendo"><i></i><i></i><i></i></span>');
    window.setTimeout(function () { esperando.remove(); responder(texto); }, 620);
  }

  [].slice.call(document.querySelectorAll('.dc-quick button')).forEach(function (b) {
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
