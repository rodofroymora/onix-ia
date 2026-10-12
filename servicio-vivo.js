/* ÓNIX · Página de servicio "viva": recorrido con panel fijo, pausa y fila con criterios.
   Vanilla, sin dependencias. Sin JS la página queda completa y legible (clase .no-sv). */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  root.classList.remove('no-sv');
  root.classList.add('sv-js');

  /* ── Recorrido: el paso visible manda sobre el panel ─────────── */
  var panel = d.querySelector('.panel[data-step]');
  var steps = [].slice.call(d.querySelectorAll('.sv-step[data-step]'));
  var rail = d.querySelector('.sv-rail i');
  function activar(n) {
    if (!panel || panel.getAttribute('data-step') === n) return;
    panel.setAttribute('data-step', n);
    steps.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-step') === n); });
    if (rail) rail.style.setProperty('--prog', String(Number(n) / steps.length));
  }
  if (panel && steps.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) activar(en.target.getAttribute('data-step')); });
    }, { rootMargin: window.matchMedia('(max-width: 900px)').matches ? '-70% 0px -22% 0px' : '-48% 0px -48% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* ── Pausa (panel y fila comparten el mismo estado) ───────────── */
  var pausas = [].slice.call(d.querySelectorAll('[data-pause]'));
  var queue = d.querySelector('[data-queue]');
  function pausar(on) {
    pausas.forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var l = b.querySelector('[data-pause-label]');
      if (l) l.textContent = on ? 'Reanudar' : (b.closest('[data-queue]') ? 'Pausar el radar' : 'Pausar');
    });
    if (panel) panel.classList.toggle('is-paused', on);
    if (queue) queue.classList.toggle('is-paused', on);
  }
  pausas.forEach(function (b) { b.addEventListener('click', function () { pausar(b.getAttribute('aria-pressed') !== 'true'); }); });

  /* ── Fila: los criterios activos reordenan a los prospectos ───── */
  if (!queue) return;
  var NOMBRES = { propuesta: 'Pidió propuesta', cuando: 'Dijo para cuándo', contacto: 'Aceptó contacto', catalogo: 'En catálogo', cliente: 'Ya es cliente' };
  var toggles = [].slice.call(d.querySelectorAll('.tog[data-k]'));
  var list = queue.querySelector('.queue__list');
  var cards = [].slice.call(list.querySelectorAll('.qcard'));
  list.style.setProperty('--n', String(cards.length));
  var data = cards.map(function (el, i) {
    var s = (el.getAttribute('data-s') || '').split(/\s+/).filter(Boolean);
    return { el: el, i: i, s: s };
  });
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function ordenar() {
    var act = toggles.filter(function (t) { return t.getAttribute('aria-pressed') === 'true'; }).map(function (t) { return t.getAttribute('data-k'); });
    data.forEach(function (it) {
      it.m = act.filter(function (k) { return it.s.indexOf(k) > -1; }).length;
      var r = act.length ? it.m / act.length : 0;
      it.p = r >= .75 ? 'alta' : r >= .4 ? 'media' : 'baja';
    });
    var orden = data.slice().sort(function (a, b) { return b.m - a.m || a.i - b.i; });
    orden.forEach(function (it, pos) {
      var el = it.el;
      el.style.setProperty('--pos', String(pos));
      el.style.zIndex = String(10 - pos);
      el.classList.toggle('is-top', pos === 0 && it.m > 0);
      el.querySelector('.qcard__rank').textContent = dos(pos + 1);
      var pr = el.querySelector('.prio');
      pr.className = 'prio prio--' + it.p;
      pr.textContent = it.p === 'alta' ? 'Alta' : it.p === 'media' ? 'Media' : 'Baja';
      var why = el.querySelector('.qcard__why');
      why.innerHTML = '';
      act.forEach(function (k) {
        var sp = d.createElement('span');
        var tiene = it.s.indexOf(k) > -1;
        sp.textContent = NOMBRES[k];
        if (tiene) sp.className = 'on';
        sp.setAttribute('aria-label', NOMBRES[k] + (tiene ? ': sí' : ': no'));
        why.appendChild(sp);
      });
    });
    orden.forEach(function (it, pos) { it.el.setAttribute('aria-label', 'Lugar ' + (pos + 1) + ': prioridad ' + it.p); });
  }
  toggles.forEach(function (t) {
    t.addEventListener('click', function () {
      t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      ordenar();
    });
  });
  ordenar();
})();
