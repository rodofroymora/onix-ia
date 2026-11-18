/* Carrusel de situaciones del hero. Avanza solo cada 5 s hasta que se usa un control. */
(function () {
  'use strict';
  var root = document.querySelector('[data-situaciones]');
  if (!root) return;
  var slides = [].slice.call(root.querySelectorAll('[data-slide]'));
  var dots = [].slice.call(root.querySelectorAll('[data-dot]'));
  var live = root.querySelector('[data-live]');
  var prev = root.querySelector('[data-prev]');
  var next = root.querySelector('[data-next]');
  if (!slides.length || !prev || !next || dots.length !== slides.length) return;

  var index = 0;
  var timer = null;
  var stopped = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var INTERVAL = 5000;

  function paint(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach(function (slide, n) {
      var on = n === index;
      slide.classList.toggle('is-on', on);
      slide.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) slide.removeAttribute('inert');
      else slide.setAttribute('inert', '');
    });
    dots.forEach(function (dot, n) {
      if (n === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function announce() {
    if (!live) return;
    var quote = slides[index].querySelector('.hx-slide__quote');
    live.textContent = quote ? quote.textContent : '';
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function markAuto() {
    root.setAttribute('data-auto', timer ? 'on' : 'off');
  }

  function arm() {
    clearTimer();
    if (stopped || reduce.matches) {
      markAuto();
      return;
    }
    timer = setInterval(function () { paint(index + 1); }, INTERVAL);
    markAuto();
  }

  function stop() {
    stopped = true;
    clearTimer();
    markAuto();
  }

  function go(i) {
    stop();
    paint(i);
    announce();
  }

  dots.forEach(function (dot, n) {
    dot.addEventListener('click', function () { go(n); });
  });
  prev.addEventListener('click', function () { go(index - 1); });
  next.addEventListener('click', function () { go(index + 1); });
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(e.key === 'ArrowRight' ? index + 1 : index - 1);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimer();
      markAuto();
    } else {
      arm();
    }
  });
  if (typeof reduce.addEventListener === 'function') reduce.addEventListener('change', arm);

  root.classList.add('is-ready');
  paint(0);
  arm();
})();
