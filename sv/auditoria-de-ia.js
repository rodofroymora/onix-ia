/* ÓNIX · Auditoría IA Confiable: «Pruébalo» (prácticas sí/no → brechas por prioridad).
   Vanilla, sin dependencias. Sin JS la página muestra todas las brechas (todas las respuestas en «No»). */
(function () {
  'use strict';
  var d = document;
  var qs = [].slice.call(d.querySelectorAll('.au-q[data-k]'));
  var list = d.querySelector('.au-gaps__list');
  if (!qs.length || !list) return;
  var gaps = [].slice.call(list.querySelectorAll('.au-gap[data-k]'));
  var count = d.querySelector('[data-count]');
  var empty = d.querySelector('[data-empty]');
  var PALABRAS = ['Sin brechas abiertas', 'Una brecha abierta', 'Dos brechas abiertas', 'Tres brechas abiertas', 'Cuatro brechas abiertas', 'Cinco brechas abiertas', 'Seis brechas abiertas'];
  var PRIO = { '1': 'alta', '2': 'media', '3': 'baja' };

  function dos(n) { return (n < 10 ? '0' : '') + n; }

  function respuesta(k) {
    var q = d.querySelector('.au-q[data-k="' + k + '"] [data-v="si"]');
    return q && q.getAttribute('aria-pressed') === 'true' ? 'si' : 'no';
  }

  function actualizar(cambiada) {
    var abiertas = 0;
    gaps.forEach(function (g) {
      var k = g.getAttribute('data-k');
      var cerrada = respuesta(k) === 'si';
      var antes = g.hidden;
      g.hidden = cerrada;
      if (!cerrada) {
        abiertas++;
        g.querySelector('.au-gap__rank').textContent = dos(abiertas);
        g.setAttribute('aria-label', 'Lugar ' + abiertas + ': prioridad ' + PRIO[g.getAttribute('data-p')]);
        if (antes && k === cambiada) {
          g.classList.remove('is-new');
          void g.offsetWidth;
          g.classList.add('is-new');
        }
      }
    });
    if (count) {
      count.textContent = PALABRAS[abiertas] || PALABRAS[PALABRAS.length - 1];
      count.classList.toggle('is-zero', abiertas === 0);
    }
    if (empty) empty.hidden = abiertas !== 0;
    list.hidden = abiertas === 0;
  }

  qs.forEach(function (q) {
    var k = q.getAttribute('data-k');
    var bs = [].slice.call(q.querySelectorAll('.au-yn__b'));
    bs.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-pressed') === 'true') return;
        bs.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        actualizar(k);
      });
    });
  });
  actualizar(null);
})();
