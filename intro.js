/* ÓNIX · Intro de la landing con scroll (la misma de los reels de Instagram).
   Al cargar: la O se dibuja y los servicios entran en la órbita.
   Al bajar: todo gira con el scroll; luego la O se borra, el punto cae al agua
   y las ondas abren la página. Al subir, se rearma.
   Sin JS o con movimiento reducido no existe (compuerta en <head> y home.css). */
(function () {
  'use strict';
  var d = document, w = window, root = d.documentElement;
  var el = d.getElementById('intro');
  if (!el || !root.classList.contains('intro-on')) { if (el) el.remove(); return; }
  root.classList.add('intro-ready');

  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s) { return el.querySelector(s); };
  var stage = $('.intro__stage'), svg = $('.intro__svg');
  var ringO = $('[data-o]'), ring1 = $('[data-r1]'), ring2 = $('[data-r2]');
  var dot = $('[data-dot]'), halo = $('[data-halo]'), water = $('[data-water]'), waterBody = $('[data-water-body]');
  var wave = $('[data-wave]'), word = $('[data-word]'), tag = $('[data-tag]'), cue = $('[data-cue]');
  var brand = $('.intro__brand'), skip = $('[data-skip]');
  var chips = [].slice.call(el.querySelectorAll('[data-chip]'));

  var clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, v)); };
  var range = function (p, a, b) { return clamp((p - a) / (b - a)); };
  var ease = function (p) { return 1 - Math.pow(1 - p, 3); };
  var easeIn = function (p) { return p * p * p; };
  var easeInOut = function (p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };

  /* Geometría en píxeles del escenario (pantalla completa, fijo mientras dura el scroll) */
  var vw, vh, u, CX, CY, RO, R1, RX, RY, WY, RL, D;
  function layout() {
    vw = stage.clientWidth; vh = stage.clientHeight;
    D = Math.max(1, el.offsetHeight - vh);
    u = Math.min(vw < 520 ? vw / 1000 : vw / 720, vh / 1300);
    CX = vw / 2; CY = vh * .4;
    RO = 150 * u; R1 = 240 * u; RX = 350 * u; RY = Math.max(350 * u, Math.min(vh * .24, 350 * u * 1.6));
    svg.setAttribute('viewBox', '0 0 ' + vw + ' ' + vh);
    [[ringO, RO], [ring1, R1]].forEach(function (a) { a[0].setAttribute('cx', CX); a[0].setAttribute('cy', CY); a[0].setAttribute('r', a[1]); });
    ring2.setAttribute('cx', CX); ring2.setAttribute('cy', CY); ring2.setAttribute('rx', RX); ring2.setAttribute('ry', RY);
    ringO.setAttribute('stroke-width', 44 * u);
    ringO.setAttribute('transform', 'rotate(-90 ' + CX + ' ' + CY + ')');
    RL = 2 * Math.PI * RO; ringO.style.strokeDasharray = RL;
    brand.style.top = (CY + RY + 34) + 'px';
    WY = Math.max(CY + RY + 34 + brand.offsetHeight + 56, vh * .86);
    water.setAttribute('x1', 0); water.setAttribute('x2', vw); water.setAttribute('y1', WY); water.setAttribute('y2', WY);
    waterBody.setAttribute('x', 0); waterBody.setAttribute('width', vw); waterBody.setAttribute('y', WY); waterBody.setAttribute('height', Math.max(0, vh - WY));
  }

  var ripples = [0, .22, .44].map(function () {
    var e = d.createElementNS(NS, 'ellipse');
    e.setAttribute('fill', 'none'); e.setAttribute('stroke', '#B9A4FF'); e.setAttribute('stroke-width', '3');
    e.style.opacity = '0';
    svg.appendChild(e); return e;
  });
  layout();
  w.addEventListener('resize', layout);

  /* Tramos del scroll (0 = arriba, 1 = la página ya se abrió) */
  var OUT_A = .42, OUT_B = .58;   // servicios y marca se van
  var FALL_A = .6, IMPACT = .76;  // el punto cae
  var OPEN_A = .8, OPEN_B = 1;    // las ondas abren la página

  var start = null, impactAt = null, revealed = false, running = false;

  function reveal(on) {
    if (on === revealed) return;
    revealed = on;
    root.classList.toggle('intro-on', !on);
    root.classList.toggle('intro-done', on);
  }

  function frame(now) {
    if (start === null) start = now;
    var t = (now - start) / 1000;                        // tiempo desde la carga (armado inicial)
    var p = clamp((w.scrollY || w.pageYOffset) / D);     // avance del scroll
    /* Ya abajo en la página: dormir hasta que el usuario regrese arriba */
    if (p >= 1 && t > 3 && stage.style.visibility === 'hidden') { reveal(true); running = false; return; }

    /* La O: se dibuja al cargar, se borra con el scroll */
    var draw = ease(clamp((t - .1) / 1.1));
    var undraw = ease(range(p, .48, .62));
    ringO.style.strokeDashoffset = undraw > 0 ? -RL * undraw : RL * (1 - draw);
    ringO.style.opacity = 1 - range(p, .58, .62);

    /* Órbitas */
    var ringsOut = 1 - range(p, .5, .6);
    ring1.style.opacity = Math.min(ease(clamp((t - .5) / .6)), ringsOut);
    ring2.style.opacity = Math.min(ease(clamp((t - .7) / .6)), ringsOut);

    /* Servicios: entran al cargar y giran con el scroll (más una deriva suave) */
    var spin = p * 260 + t * 4;
    var chipsOut = 1 - range(p, OUT_A, OUT_B);
    chips.forEach(function (c, i) {
      var a = (-90 + i * 72 + spin) * Math.PI / 180;
      var px = CX + Math.cos(a) * RX, py = CY + Math.sin(a) * RY;
      var cw = c.offsetWidth, ch = c.offsetHeight;
      var left = clamp(px - cw / 2, 10, vw - cw - 10), top = py - ch / 2;
      var pin = ease(clamp((t - (1.0 + i * .18)) / .6));
      c.style.opacity = Math.min(pin, ease(chipsOut));
      c.style.transform = 'translate(' + left + 'px,' + (top + (1 - pin) * 14) + 'px) scale(' + (.9 + .1 * Math.min(pin, .5 + .5 * chipsOut)) + ')';
    });

    /* Marca y lema */
    var wIn = ease(clamp((t - .9) / .6)), gIn = ease(clamp((t - 1.3) / .6));
    var bOut = ease(1 - range(p, OUT_A - .06, OUT_B - .06));
    word.style.opacity = Math.min(wIn, bOut);
    word.style.transform = 'translateY(' + ((1 - wIn) * 16 - (1 - bOut) * 24) + 'px)';
    tag.style.opacity = Math.min(gIn, bOut);
    tag.style.transform = 'translateY(' + ((1 - gIn) * 16 - (1 - bOut) * 24) + 'px)';
    cue.style.opacity = Math.min(ease(clamp((t - 2.0) / .6)), 1 - range(p, 0, .06));

    /* El punto: baja, orbita con el scroll y cae al agua */
    var drop = ease(clamp((t - .7) / .5));
    var ang = (Math.min(p, FALL_A) * 520 + t * 10) * Math.PI / 180;
    var x0 = CX + Math.sin(ang) * R1, y0 = CY - Math.cos(ang) * R1 - (1 - drop) * 110 * u;
    var fall = easeIn(range(p, FALL_A, IMPACT));
    var dotX = x0, dotY = y0 + fall * (WY - y0);
    var sunk = range(p, IMPACT, IMPACT + .03);
    var dr = Math.max(9, 22 * u) * (1 - .6 * sunk);
    dot.setAttribute('cx', dotX); dot.setAttribute('cy', dotY); dot.setAttribute('r', dr);
    halo.setAttribute('cx', dotX); halo.setAttribute('cy', dotY); halo.setAttribute('r', dr * 1.8);
    var dotOp = Math.min(drop, 1 - ease(sunk));
    dot.style.opacity = dotOp; halo.style.opacity = dotOp * .2;

    /* Agua */
    var wat = range(p, .5, .6);
    water.style.opacity = wat; waterBody.style.opacity = wat;

    /* Ondas: al tocar el agua se disparan solas, como en el agua de verdad */
    if (p >= IMPACT && impactAt === null) impactAt = now;
    if (p < IMPACT - .01) impactAt = null;
    ripples.forEach(function (e, i) {
      var q = impactAt === null ? 0 : clamp(((now - impactAt) / 1000 - i * .22) / 1.3);
      e.setAttribute('cx', dotX); e.setAttribute('cy', WY);
      e.setAttribute('rx', 14 + Math.min(vw * .45, 460) * ease(q)); e.setAttribute('ry', 4 + 60 * ease(q));
      e.style.opacity = q > 0 ? (1 - q) * .9 : 0;
    });

    /* La onda abre la página desde el punto de impacto, con borde de agua */
    var open = easeInOut(range(p, OPEN_A, OPEN_B));
    if (open > 0) {
      var far = Math.hypot(Math.max(dotX, vw - dotX), Math.max(WY, vh - WY)) + 60;
      var r = far * open, f = 36;
      var m = 'radial-gradient(circle at ' + dotX + 'px ' + WY + 'px, transparent ' + r + 'px, rgba(0,0,0,.55) ' + (r + f * .5) + 'px, #000 ' + (r + f) + 'px)';
      stage.style.webkitMaskImage = m; stage.style.maskImage = m;
      wave.setAttribute('cx', dotX); wave.setAttribute('cy', WY); wave.setAttribute('r', r + f * .6);
      wave.style.opacity = String(.9 * (1 - open));
    } else {
      stage.style.webkitMaskImage = ''; stage.style.maskImage = '';
      wave.style.opacity = '0';
    }
    stage.style.opacity = String(1 - range(p, .94, 1));
    stage.style.visibility = p >= 1 ? 'hidden' : '';
    reveal(p > .86);

    w.requestAnimationFrame(frame);
  }

  /* Saltar: lleva directo al inicio de la página */
  if (skip) skip.addEventListener('click', function () { w.scrollTo({ top: D, behavior: 'instant' }); });

  function wake() { if (!running) { running = true; w.requestAnimationFrame(frame); } }
  w.addEventListener('scroll', wake, { passive: true });
  w.addEventListener('resize', wake);
  wake();
})();
