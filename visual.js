/* Carrusel del sistema visual. Sin avance automático. Con prefers-reduced-motion el salto es instantáneo. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cars = document.querySelectorAll('[data-v-car]');
  [].forEach.call(cars, function (car) {
    var rail = car.querySelector('[data-v-rail]');
    if (!rail) return;
    var cards = [].slice.call(rail.querySelectorAll('[data-v-card]'));
    var dots = [].slice.call(car.querySelectorAll('[data-v-dot]'));
    var tabs = [].slice.call(car.querySelectorAll('[role="tab"]'));
    if (!cards.length) return;
    var cur = 0;

    function nearest() {
      var mid = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      var best = 0;
      var bestD = Infinity;
      cards.forEach(function (c, i) {
        var b = c.getBoundingClientRect();
        var d = Math.abs(b.left + b.width / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }

    function mark(i) {
      cur = i;
      dots.forEach(function (d, n) {
        if (n === i) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
    }

    function go(i) {
      if (!cards.length) return;
      i = Math.max(0, Math.min(cards.length - 1, i));
      var card = cards[i];
      var delta = card.getBoundingClientRect().left - rail.getBoundingClientRect().left;
      var left = rail.scrollLeft + delta - (rail.clientWidth - card.clientWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
      mark(i);
    }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { go(i); });
    });
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { go(i); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % cards.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + cards.length) % cards.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = cards.length - 1;
        if (n === null) return;
        e.preventDefault();
        go(n);
        tabs[n].focus();
      });
    });
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.max(0, cur - 1)); }
    });
    var ticking = false;
    rail.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; mark(nearest()); });
    }, { passive: true });
    mark(0);
  });
})();
