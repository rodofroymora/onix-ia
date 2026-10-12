/* ÓNIX · Documentos Vivos: «Pruébalo».
   El visitante elige una pregunta de ejemplo y ve el rastro de la búsqueda y la respuesta con sus fuentes.
   Todo el contenido ya está en el HTML (sin JS se ven todas las respuestas). Datos ficticios; no se envía ni se guarda nada. */
(function () {
  'use strict';
  var d = document;
  var caja = d.querySelector('[data-dvq]');
  var picks = [].slice.call(d.querySelectorAll('.dvq-pick[data-q]'));
  if (!caja || !picks.length) return;

  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var resp = [].slice.call(caja.querySelectorAll('.dvq-a[data-a]'));
  var timers = [];
  d.documentElement.classList.add('dvq-js');

  function limpiar() { timers.forEach(function (t) { clearTimeout(t); }); timers = []; }
  function luego(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function correr(art) {
    var q = art.querySelector('.dvq-a__q');
    var pasos = [].slice.call(art.querySelectorAll('.dvq-trace li'));
    var r = art.querySelector('.dvq-r');
    [q, r].concat(pasos).forEach(function (el) { el.classList.remove('on', 'busy'); });
    if (quieto) { art.classList.remove('is-run'); return; }
    art.classList.add('is-run');
    luego(function () { q.classList.add('on'); }, 60);
    pasos.forEach(function (li, i) {
      luego(function () {
        if (i) pasos[i - 1].classList.remove('busy');
        li.classList.add('on', 'busy');
      }, 380 + i * 520);
    });
    luego(function () {
      if (pasos.length) pasos[pasos.length - 1].classList.remove('busy');
      r.classList.add('on');
    }, 380 + pasos.length * 520);
  }

  function elegir(clave, animar) {
    limpiar();
    picks.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-q') === clave ? 'true' : 'false'); });
    resp.forEach(function (a) {
      var on = a.getAttribute('data-a') === clave;
      a.classList.toggle('is-on', on);
      if (on) { if (animar) correr(a); else a.classList.remove('is-run'); }
    });
  }

  picks.forEach(function (b) {
    b.addEventListener('click', function () {
      elegir(b.getAttribute('data-q'), true);
      /* En pantallas angostas la respuesta queda debajo de las preguntas: la acercamos. */
      if (window.matchMedia('(max-width: 900px)').matches && caja.scrollIntoView) {
        caja.scrollIntoView({ block: 'nearest', behavior: quieto ? 'auto' : 'smooth' });
      }
    });
  });

  var inicial = picks.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || picks[0];
  elegir(inicial.getAttribute('data-q'), false);

  /* La primera respuesta se anima cuando el bloque entra en pantalla. */
  if ('IntersectionObserver' in window && !quieto) {
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      var activo = resp.filter(function (a) { return a.classList.contains('is-on'); })[0];
      if (activo) correr(activo);
    }, { threshold: .35 });
    io.observe(caja);
  }
})();
