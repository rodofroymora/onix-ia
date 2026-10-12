/* ÓNIX · Ruta IA: "Pruébalo". El visitante marca impacto y facilidad de cada caso de uso
   de ejemplo y la ruta se reordena. Vanilla, sin dependencias. Sin JS queda el estado inicial. */
(function () {
  'use strict';
  var d = document;
  var route = d.querySelector('[data-ri-route]');
  var ctrls = d.querySelector('[data-ri-ctrls]');
  if (!route || !ctrls) return;

  var btns = [].slice.call(ctrls.querySelectorAll('.ri-pill[data-c][data-k]'));
  var cards = [].slice.call(route.querySelectorAll('.qcard[data-c]'));
  var status = route.querySelector('[data-ri-status]');
  var list = route.querySelector('.ri-list');
  if (list) list.style.setProperty('--n', String(cards.length));

  /* Lugares fijos dentro de cada cuadrante para que los puntos no se encimen */
  var SLOT = { 1: [2, 0], 2: [13, 16], 3: [24, 0], 4: [2, 16], 5: [13, 0], 6: [24, 16] };
  var ETIQUETA = { 3: 'Primero', 2: 'Después', 1: 'Después', 0: 'Por ahora no' };
  var CLASE = { 3: 'alta', 2: 'media', 1: 'media', 0: 'baja' };

  var items = cards.map(function (el, i) {
    var c = el.getAttribute('data-c');
    return {
      c: c, i: i, el: el,
      name: el.querySelector('.qcard__who strong').textContent,
      dot: route.querySelector('.ri-dot[data-c="' + c + '"]')
    };
  });

  function activo(c, k) {
    var b = ctrls.querySelector('.ri-pill[data-c="' + c + '"][data-k="' + k + '"]');
    return !!b && b.getAttribute('aria-pressed') === 'true';
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }

  function ordenar() {
    items.forEach(function (it) {
      it.imp = activo(it.c, 'imp');
      it.facil = activo(it.c, 'facil');
      it.score = (it.imp ? 2 : 0) + (it.facil ? 1 : 0);
    });
    var orden = items.slice().sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    var primeros = [];
    orden.forEach(function (it, pos) {
      var el = it.el;
      el.style.setProperty('--pos', String(pos));
      el.style.zIndex = String(10 - pos);
      el.classList.toggle('is-top', pos === 0 && it.score > 0);
      el.querySelector('.qcard__rank').textContent = dos(pos + 1);
      var pr = el.querySelector('.prio');
      pr.className = 'prio prio--' + CLASE[it.score];
      pr.textContent = ETIQUETA[it.score];
      var why = el.querySelectorAll('.qcard__why span');
      if (why[0]) why[0].classList.toggle('on', it.imp);
      if (why[1]) why[1].classList.toggle('on', it.facil);
      el.setAttribute('aria-label', 'Lugar ' + (pos + 1) + ': ' + it.name + ', ' + ETIQUETA[it.score].toLowerCase());
      if (it.score === 3) primeros.push(it.name);
      if (it.dot) {
        var s = SLOT[it.c] || [12, 12];
        it.dot.style.setProperty('--x', String((it.facil ? 62 : 12) + s[0]));
        it.dot.style.setProperty('--y', String((it.imp ? 22 : 62) + s[1]));
        it.dot.textContent = String(pos + 1);
        it.dot.classList.toggle('hot', it.score === 3);
      }
    });
    if (status) {
      status.textContent = primeros.length
        ? 'Primero: ' + (primeros.length > 1 ? primeros.slice(0, -1).join(', ') + ' y ' + primeros[primeros.length - 1] : primeros[0]) + '.'
        : 'Todavía no hay casos con más impacto y más fácil a la vez. Marca los dos criterios en alguno.';
    }
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      ordenar();
    });
  });
  ordenar();
})();
