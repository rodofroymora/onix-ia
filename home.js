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

/* ── Estimador: preguntas con un clic, reglas fijas, mensaje de WhatsApp ya escrito ── */
(function () {
  'use strict';
  var d = document, w = window;
  var box = d.querySelector('[data-est]');
  if (!box) return;
  d.documentElement.classList.add('h-ready');
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var log = box.querySelector('[data-est-log]');
  var opts = box.querySelector('[data-est-opts]');
  var res = box.querySelector('[data-est-res]');
  var prog = box.querySelector('[data-est-prog]');
  var wa = box.querySelector('[data-est-wa]');
  var BASE = 'https://wa.me/522227097945?text=';
  var AVISO = 'Aviso de privacidad: https://www.onix-ia.com/aviso-de-privacidad';
  /* n: 0 Arranque · 1 Negocio · 2 A tu medida. El nivel final es el más alto que marque cualquier respuesta. */
  var PREG = [
    { k: 'sol', q: '¿Qué quieres resolver primero?', o: [
      ['Atender WhatsApp o mi sitio', 0, 'Asistentes de WhatsApp y Voz'],
      ['Ordenar a mis prospectos', 0, 'Radar de Leads'],
      ['Consultar mis documentos', 0, 'Base de Conocimiento Inteligente'],
      ['Preparar la información para mi contador', 0, 'Contabilidad Asistida'],
      ['Automatizar tareas de operación', 0, 'Agentes de Operación'],
      ['Varias de estas', 2, 'varias soluciones'],
      ['Otra cosa', 2, 'algo a la medida']] },
    { k: 'can', q: '¿Por cuántos canales te escriben o te llega la información?', o: [['Uno', 0], ['Dos', 1], ['Tres o más', 2]] },
    { k: 'vol', q: '¿Cuántos mensajes o solicitudes recibes al mes, más o menos?', o: [['Menos de 300', 0], ['Entre 300 y 1,000', 1], ['Más de 1,000', 2]] },
    { k: 'per', q: '¿Cuántas personas de tu equipo atienden o aprueban?', o: [['Una', 0], ['De dos a cinco', 1], ['Más de cinco', 2]] },
    { k: 'con', q: '¿Con qué tendría que conectarse?', o: [['Con nada por ahora', 0], ['Una hoja de cálculo', 1], ['Mi sistema o herramienta comercial', 2]] },
    { k: 'tel', q: '¿Necesitas que también atienda llamadas?', o: [['No', 0], ['Sí', 2]] }
  ];
  /* El resultado ya no es un precio: es por dónde empezar y con qué alcance.
     El servicio sale de la primera pregunta; el alcance, del resto. */
  var ALCANCE = [
    { nom: 'Acotado',
      desc: 'Una solución y un canal.',
      paso: 'Es el mejor punto de partida: se ve si funciona antes de ampliar. El primer paso sería dejar ese canal atendido, con alguien de tu equipo aprobando lo que sale.' },
    { nom: 'Con más de un frente',
      desc: 'Varios canales o un equipo que ya se reparte el trabajo.',
      paso: 'Se puede empezar por uno y sumar el resto después. El primer paso sería elegir el canal que más te duele hoy y dejarlo resuelto.' },
    { nom: 'A tu medida',
      desc: 'Tu caso combina varias soluciones, llamadas o sistemas propios.',
      paso: 'No hay respuesta de catálogo, y está bien. El primer paso sería una revisión inicial para ordenar por dónde conviene entrar, sin comprometerte a nada.' }
  ];
  var i = 0, resp = {}, nivel = 0;

  function burbuja(texto, mia) {
    var p = d.createElement('p');
    p.className = 'est__msg' + (mia ? ' est__msg--me' : '');
    p.textContent = texto;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }
  function escribiendo(cb) {
    if (reduce) { cb(); return; }
    var t = d.createElement('span');
    t.className = 'est__typing'; t.setAttribute('aria-hidden', 'true');
    t.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(t); log.scrollTop = log.scrollHeight;
    setTimeout(function () { t.remove(); cb(); }, 650);
  }
  function preguntar() {
    opts.innerHTML = '';
    prog.style.setProperty('--p', String(i / PREG.length));
    if (i >= PREG.length) { terminar(); return; }
    var P = PREG[i];
    escribiendo(function () {
      burbuja(P.q);
      P.o.forEach(function (o) {
        var b = d.createElement('button');
        b.type = 'button';
        b.textContent = o[0];
        b.addEventListener('click', function () {
          resp[P.k] = { txt: o[0], extra: o[2] };
          nivel = Math.max(nivel, o[1]);
          opts.innerHTML = '';
          burbuja(o[0], true);
          i++;
          preguntar();
        });
        opts.appendChild(b);
      });
      var f = opts.querySelector('button');
      if (f && box.contains(d.activeElement)) f.focus();
    });
  }
  function terminar() {
    var A = ALCANCE[nivel];
    var servicio = resp.sol.extra || resp.sol.txt;
    var esMedida = nivel === 2 || /varias|medida/i.test(servicio);
    escribiendo(function () {
      burbuja(esMedida
        ? 'Listo. Tu caso no tiene una respuesta de catálogo, y está bien: lo vemos juntos.'
        : 'Listo. Esto es por dónde yo empezaría.');

      box.querySelector('[data-est-lvl]').innerHTML =
        '<span>Yo empezaría por</span>' + (esMedida ? 'Una revisión inicial' : servicio);

      var alc = box.querySelector('[data-est-alcance]');
      if (alc) alc.innerHTML = '<span>Alcance</span>' + A.nom;

      box.querySelector('[data-est-inc]').textContent = A.desc + ' ' + A.paso;

      var msg = 'Hola, usé el estimador de ÓNIX. Me interesa: ' + servicio +
        '. Alcance: ' + A.nom + '. Canales: ' + resp.can.txt + '. Mensajes al mes: ' + resp.vol.txt +
        '. Personas: ' + resp.per.txt + '. Conexión: ' + resp.con.txt + '. Llamadas: ' + resp.tel.txt + '. ' + AVISO;
      wa.href = BASE + encodeURIComponent(msg);
      res.hidden = false;
      res.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
  }
  box.querySelector('[data-est-again]').addEventListener('click', function () {
    i = 0; resp = {}; nivel = 0; res.hidden = true;
    log.innerHTML = '';
    burbuja('Empecemos de nuevo.');
    preguntar();
  });
  preguntar();
})();
