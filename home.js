/* ÓNIX · Inicio: logo vivo, manifiesto que se ilumina, pestañas, carrusel y simulador de gasto.
   Vanilla, sin dependencias. Sin JS la página queda completa (clase .no-h). */
(function () {
  'use strict';
  var d = document, root = d.documentElement, w = window;
  root.classList.remove('no-h');
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) root.classList.add('h-js');

  /* ── Manifiesto: cada palabra se ilumina según avanza el scroll ── */
  var man = d.querySelector('[data-words]');
  if (man && !reduce) {
    var words = [];
    [].slice.call(man.childNodes).forEach(function (n) {
      var accent = n.nodeType === 1;
      var text = n.textContent;
      var frag = d.createDocumentFragment();
      text.split(/(\s+)/).forEach(function (t) {
        if (!t) return;
        if (/^\s+$/.test(t)) { frag.appendChild(d.createTextNode(t)); return; }
        var s = d.createElement('span');
        s.textContent = t;
        if (accent) s.className = 'ac';
        words.push(s);
        frag.appendChild(s);
      });
      man.replaceChild(frag, n);
    });
    var ticking = false;
    var pintar = function () {
      ticking = false;
      var r = man.getBoundingClientRect(), vh = w.innerHeight;
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
      p = Math.max(0, Math.min(1, p));
      var n = Math.round(p * words.length);
      words.forEach(function (s, i) { s.classList.toggle('on', i < n); });
    };
    w.addEventListener('scroll', function () { if (!ticking) { ticking = true; w.requestAnimationFrame(pintar); } }, { passive: true });
    pintar();
  }

  /* ── Pestañas: soluciones listas / a tu medida ─────────────── */
  var tabs = [].slice.call(d.querySelectorAll('[role="tab"]'));
  function elegir(t) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.setAttribute('aria-selected', on ? 'true' : 'false');
      x.tabIndex = on ? 0 : -1;
      var p = d.getElementById(x.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { elegir(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      elegir(n); n.focus(); e.preventDefault();
    });
  });

  /* ── Carrusel: scroll-snap nativo + controles + avance automático pausable ── */
  var car = d.querySelector('[data-car]');
  if (car) {
    var track = car.querySelector('.car__track');
    var slides = [].slice.call(track.querySelectorAll('.slide'));
    var dotsBox = car.querySelector('.car__dots');
    var play = car.querySelector('[data-play]');
    var cur = 0, timer = null, paused = reduce, hover = false;
    var dots = slides.map(function (s, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', s.getAttribute('aria-label'));
      b.addEventListener('click', function () { ir(i, true); });
      dotsBox.appendChild(b);
      return b;
    });
    function marcar(i) { cur = i; dots.forEach(function (b, k) { b.setAttribute('aria-current', k === i ? 'true' : 'false'); }); }
    function ir(i, user) {
      i = (i + slides.length) % slides.length;
      var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' });
      marcar(i);
      if (user) reiniciar();
    }
    car.querySelector('[data-prev]').addEventListener('click', function () { ir(cur - 1, true); });
    car.querySelector('[data-next]').addEventListener('click', function () { ir(cur + 1, true); });
    if ('IntersectionObserver' in w) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio > .6) marcar(slides.indexOf(e.target)); });
      }, { root: track, threshold: [.6] });
      slides.forEach(function (s) { io.observe(s); });
    }
    function reiniciar() {
      clearInterval(timer);
      if (!paused) timer = setInterval(function () { if (!hover && !d.hidden) ir(cur + 1); }, 5200);
    }
    function setPausa(on) {
      paused = on;
      play.setAttribute('aria-pressed', on ? 'true' : 'false');
      play.setAttribute('aria-label', on ? 'Reproducir el carrusel' : 'Pausar el carrusel');
      play.innerHTML = on
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
      reiniciar();
    }
    play.addEventListener('click', function () { setPausa(!paused); });
    car.addEventListener('mouseenter', function () { hover = true; });
    car.addEventListener('mouseleave', function () { hover = false; });
    car.addEventListener('focusin', function () { hover = true; });
    car.addEventListener('focusout', function () { hover = false; });
    track.addEventListener('pointerdown', function () { if (!paused) setPausa(true); });
    marcar(0);
    setPausa(paused);
  }

  /* ── Simulador: mismo trabajo, distinto gasto ─────────────── */
  var sim = d.querySelector('[data-sim]');
  if (sim) {
    var modos = [].slice.call(sim.querySelectorAll('[data-mode]'));
    var tareas = [].slice.call(sim.querySelectorAll('.task'));
    var total = sim.querySelector('[data-total]');
    var nota = sim.querySelector('[data-sim-note]');
    var NOMBRE = { ligero: 'Ligero', medio: 'Intermedio', avanzado: 'Avanzado' };
    function aplicar(modo) {
      modos.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === modo ? 'true' : 'false'); });
      var suma = 0;
      tareas.forEach(function (t) {
        var c = modo === 'grande' ? 1 : parseFloat(t.getAttribute('data-c'));
        var tier = modo === 'grande' ? 'avanzado' : t.getAttribute('data-t');
        suma += c;
        t.querySelector('.task__bar i').style.setProperty('--c', String(c));
        var tg = t.querySelector('.task__tier');
        tg.setAttribute('data-t', tier);
        tg.textContent = NOMBRE[tier];
      });
      total.style.setProperty('--c', String(suma / tareas.length));
      nota.textContent = modo === 'grande'
        ? 'Todo con el modelo más grande: el mismo trabajo, con el gasto al máximo. Ilustrativo: compara gasto relativo, no precios.'
        : 'Cada tarea con el modelo que le corresponde. Ilustrativo: compara gasto relativo, no precios.';
    }
    modos.forEach(function (b) { b.addEventListener('click', function () { aplicar(b.getAttribute('data-mode')); }); });
  }
})();
