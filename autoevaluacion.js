/* Autoevaluación de IA · ÓNIX
   El cálculo ocurre en el navegador. Las respuestas no se guardan.
   El resumen solo entra al enlace de WhatsApp si la persona lo marca, y no incluye
   el nombre del caso ni las respuestas sueltas. */
(function () {
  'use strict';
  var AE = window.AE_LOGICA;
  var $ = function (id) { return document.getElementById(id); };
  if (!AE || !$('qOpts')) return;

  var DIMS = AE.DIMS, LEVELS = AE.LEVELS, ROUTES = AE.ROUTES, RISKS = AE.RISKS, TYPES = AE.TYPES, AREAS = AE.AREAS;
  var STEPS = AE.STEPS, RECS = AE.RECS, SVC_URL = AE.SVC_URL, ROUTE_INFO = AE.ROUTE_INFO, WAVES = AE.WAVES;
  var LAW_BASE = AE.LAW_BASE, LAWS = AE.LAWS, RC = AE.RC, RM = AE.RM;
  var esc = AE.esc, lvl = AE.lvl, low = AE.low, compute = AE.compute, nextService = AE.nextService;

  var WA_GENERICO = $('waCta').getAttribute('href');
  var pendiente = { sample: true, stale: false, msg: '', gs: null };
  var navQ = AE.crearAvance(STEPS.length);
  var anuncioI = -1;

  function aplicarWhatsapp() {
    var box = $('waIncluir');
    var incluir = !!(box && box.checked && !box.disabled);
    $('waCta').href = AE.hrefWhatsapp({
      base: WA_GENERICO, waBase: AE.WA_BASE, incluir: incluir,
      sample: pendiente.sample, stale: pendiente.stale, gs: pendiente.gs, msg: pendiente.msg
    });
    var show = $('waCta').href !== WA_GENERICO;
    $('waPreview').hidden = !show;
    if (show) $('waPreviewText').textContent = pendiente.msg;
  }
  function consentimiento(modo) {
    var box = $('waIncluir');
    var texto = $('waConsentText');
    if (modo === 'listo') {
      box.disabled = false;
      texto.textContent = 'Incluir en el mensaje el resumen orientativo de mi resultado (nivel, ruta y prioridades). No incluye el nombre del caso ni las respuestas.';
    } else {
      box.checked = false;
      box.disabled = true;
      texto.textContent = modo === 'anterior'
        ? 'Este resultado es de un intento anterior y no se incluye. El resumen vuelve a estar disponible al terminar de nuevo.'
        : 'El resumen orientativo se puede incluir después de contestar el cuestionario.';
    }
    aplicarWhatsapp();
  }

  function render(d) {
    var r = compute(d);
    if (!r) return false;
    var rep = $('reporte');
    rep.classList.remove('is-in', 'is-stale');
    $('rStale').hidden = true;
    var flag = $('ribbon');
    flag.textContent = d.sample ? 'Reporte de ejemplo' : 'Tu reporte';
    flag.classList.toggle('is-yours', !d.sample);
    var org = d.org || 'Tu empresa';
    $('rOrg').textContent = org;
    $('rDate').textContent = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    $('rTitle').textContent = AE.tituloReporte(LEVELS[r.gl - 1]);
    var caseName = d.name ? '“' + esc(d.name) + '”' : 'Tu caso de uso principal';
    $('rExec').innerHTML = AE.htmlResumen(caseName, r);
    $('rBullets').innerHTML = AE.vinietas(r).map(function (t) { return '<li>' + t + '</li>'; }).join('');
    var prioNote = $('prioTie');
    prioNote.hidden = !r.empate;
    if (r.empate) prioNote.textContent = AE.notaEmpate();

    $('rKpis').innerHTML = [
      ['Índice global', r.gs + '<small> /100</small>'],
      ['Nivel', LEVELS[r.gl - 1]],
      ['Tipo de caso de uso', TYPES[r.tipo]],
      [AE.ETIQUETA_RIESGO, '<span class="ae-pill ' + RC[r.risk - 1] + '">' + RISKS[r.risk - 1] + '</span>'],
      ['Ruta de gobierno', '<span class="ae-pill ' + RC[r.route] + '">' + ROUTES[r.route] + '</span>'],
      ['Dimensión más baja', '<span style="font-size:1.0625rem;letter-spacing:-.01em">' + (r.dims.filter(function (x) { return x.s === r.weak[0].s; }).length > 1 ? 'Empate' : esc(r.weak[0].n)) + '</span>']
    ].map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b></div>'; }).join('');

    $('f1Title').textContent = 'Índice global de preparación: ' + r.gs + ' de 100';
    Array.prototype.forEach.call($('gBands').children, function (el, i) { el.classList.toggle('on', i === r.gl - 1); });
    $('gVal').textContent = r.gs;
    $('gMarker').style.setProperty('--g', r.gs + '%');
    var cf = $('capFlag');
    cf.hidden = !r.capped;
    if (r.capped) cf.textContent = AE.textoTope(r);

    drawRadar(r);

    $('capas').innerHTML = r.capas.map(function (c) {
      return '<div><div class="capa__h"><b>' + c.n + '</b><span>' + c.s + ' / 100</span></div>' + c.ds.map(function (x) {
        return '<div class="bar" data-tip="' + esc(x.n) + ': ' + x.s + ' de 100, nivel ' + LEVELS[x.l - 1] + '"><span>' + esc(x.n) + '</span><div class="bar__track"><div class="bar__fill lv' + x.l + '" data-w="' + x.s + '"></div></div><span class="bar__v">' + x.s + '</span></div>';
      }).join('') + '</div>';
    }).join('');

    $('f4Title').textContent = 'Ruta de gobierno: ' + ROUTES[r.route] + (r.highs >= 2 ? ' (referencia)' : '');
    var m = '<div></div>' + RISKS.map(function (x) { return '<div class="h">' + x + '</div>'; }).join(''), n = 0;
    [2, 1, 0].forEach(function (t) {
      m += '<div class="h rh">' + TYPES[t] + '</div>';
      [0, 1, 2].forEach(function (k) {
        var here = t === r.tipo && k === r.risk - 1;
        m += '<button type="button" class="cell st rt' + RM[t][k] + (here ? ' here is-sel' : '') + '" style="--d:' + (n++) + '" data-t="' + t + '" data-k="' + k + '" aria-pressed="' + here + '" aria-label="' + TYPES[t] + ' con riesgo estimado ' + low(RISKS[k]) + ': ruta ' + low(ROUTES[RM[t][k]]) + (here ? ' (tu caso)' : '') + '">' + ROUTES[RM[t][k]] + (here ? '<span class="dot" aria-hidden="true"></span>' : '') + '</button>';
      });
    });
    $('matrix').innerHTML = m;
    mxShow(r.tipo, r.risk - 1, r);

    var pr = [['Cambio en el proceso', d.proc], ['Autonomía', r.escalaAut], ['Presencia', d.pres]];
    $('profile').innerHTML = '<p class="profile__name"><b>' + esc(d.name || 'Caso de uso principal') + '</b> · ' + esc(AREAS[d.area]) + '</p>' +
      pr.map(function (p) {
        var et = AE.etiquetaPilar(p[0], p[1]);
        return '<div class="p-row" role="img" aria-label="' + esc(et) + '" data-tip="' + esc(et) + '"><span>' + p[0] + '</span><div class="steps4">' + [1, 2, 3, 4].map(function (i) { return '<span class="' + (i <= p[1] ? 'on' : '') + '" style="--d:' + i + '"></span>'; }).join('') + '</div><span class="sr-only">' + p[1] + ' de 4</span></div>';
      }).join('') +
      '<div class="p-row" aria-hidden="true"><span></span><div class="steps4 steps4--lbl"><b>Apoyo</b><b>Ampliado</b><b>Integrado</b><b>Transforma</b></div></div>';
    $('factors').innerHTML = r.factors.map(function (f, fi) { return '<span class="chip st ' + RC[f.v - 1] + '" style="--d:' + (fi + 4) + '"><span>' + f.n + '</span><b>' + RISKS[f.v - 1] + '</b></span>'; }).join('');
    $('esc').hidden = r.highs < 2;

    road(r, d);

    $('prio').innerHTML = r.weak.map(function (x, xi) {
      var rec = RECS[x.k];
      return '<li class="st" style="--d:' + xi + '"><div class="prio__main"><p class="prio__dim"><span class="ae-pill ' + RC[2 - Math.min(2, x.l - 1)] + '">' + esc(x.n) + ' · ' + x.s + ' de 100</span></p><h4>' + rec.t + '</h4><p>' + rec.w + '</p>' +
        (rec.def ? '<p class="prio__def"><b>' + rec.def[0] + '.</b> ' + rec.def[1] + '</p>' : '') +
        (rec.lv ? '<ul class="prio__lv">' + rec.lv.map(function (l) { return '<li><span class="ae-pill ' + l[0] + '">' + l[1] + '</span><span>' + l[2] + '</span></li>'; }).join('') + '</ul>' : '') +
        '</div><div class="prio__side"><p class="prio__k">Cómo empezar</p><ol class="prio__steps">' + rec.a.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ol><p class="svc">Te ayuda: <a href="' + SVC_URL[rec.s] + '">' + rec.s + '</a></p></div></li>';
    }).join('');

    $('laws').innerHTML = [LAW_BASE].concat(LAWS[d.area]).map(function (l, li) { return '<li class="st" style="--d:' + li + '"><b>' + esc(l.n) + '</b><span>' + esc(l.w) + '</span></li>'; }).join('');

    tiersRec(r, d);

    var svc = nextService(r);
    $('nextKicker').textContent = AE.KICKER + svc;
    $('nextText').textContent = (svc === AE.SERVICIO_RUTA
      ? 'Te ayudamos a decidir qué hacer con IA, en qué orden y con qué reglas, empezando por tus dimensiones más bajas.'
      : 'Podemos revisar contigo la seguridad y los riesgos de la IA que ya usas, empezando por tu caso de uso principal.') + ' Tu consultoría inicial es gratis. Es una conversación, no una contratación.';
    pendiente = {
      sample: !!d.sample,
      stale: false,
      gs: r.gs,
      msg: d.sample ? '' : AE.mensajeWhatsapp(r, svc)
    };
    consentimiento(d.sample ? 'ejemplo' : 'listo');

    rvReset();
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      rep.classList.add('is-in');
      Array.prototype.forEach.call(rep.querySelectorAll('.bar__fill'), function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
    }); });
    return true;
  }

  var RM_REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var forEach = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  function scrollBeh() { return AE.comportamientoScroll(RM_REDUCE); }

  function marcarInerte(el, on) {
    if (!el) return;
    if (on) {
      if (el.contains(document.activeElement)) {
        var destino = $('cuestionario') || $('main');
        if (destino && destino.focus) destino.focus();
      }
      el.inert = true;
    } else {
      el.inert = false;
    }
  }

  var lastR = null;
  function mxShow(t, k, r) {
    r = r || lastR; lastR = r;
    if (!r) return;
    var route = RM[t][k], mine = t === r.tipo && k === r.risk - 1;
    forEach($('matrix').querySelectorAll('.cell'), function (c) {
      var on = +c.getAttribute('data-t') === t && +c.getAttribute('data-k') === k;
      c.classList.toggle('is-sel', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var box = $('mxDetail');
    box.className = 'mx-detail rt' + route + (mine ? ' is-mine' : '');
    box.innerHTML = '<p class="mx-detail__k">' + (mine ? 'Tu caso' : 'Si tu caso fuera') + ' · ' + low(TYPES[t]) + ' con riesgo estimado ' + low(RISKS[k]) + '</p>' +
      '<p class="mx-detail__r">Ruta ' + low(ROUTES[route]) + (r.highs >= 2 && mine ? ' · referencia, no elegida' : '') + '</p><p class="mx-detail__t">' + ROUTE_INFO[route] + '</p>' +
      (mine ? '' : '<button type="button" class="mx-detail__back">Volver a mi caso</button>');
  }
  $('matrix').addEventListener('click', function (e) {
    var c = e.target.closest('.cell'); if (!c) return;
    mxShow(+c.getAttribute('data-t'), +c.getAttribute('data-k'));
  });
  $('matrix').addEventListener('keydown', function (e) {
    var c = e.target.closest('.cell'); if (!c) return;
    var mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [1, 0], ArrowDown: [-1, 0] }[e.key];
    if (!mv) return;
    e.preventDefault();
    var nt = Math.max(0, Math.min(2, +c.getAttribute('data-t') + mv[0])), nk = Math.max(0, Math.min(2, +c.getAttribute('data-k') + mv[1]));
    var nx = $('matrix').querySelector('.cell[data-t="' + nt + '"][data-k="' + nk + '"]');
    if (nx) { nx.focus(); mxShow(nt, nk); }
  });
  $('mxDetail').addEventListener('click', function (e) {
    if (e.target.closest('.mx-detail__back') && lastR) mxShow(lastR.tipo, lastR.risk - 1);
  });

  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
  var ARROW = function (d) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  function road(r, d) {
    var stages = AE.planEtapas(r, d);
    var nav = '<nav class="road__nav" aria-label="Etapas del plan"><div class="road__rail" aria-hidden="true"><i></i></div><div class="road__steps">' + stages.map(function (s, si) {
      return '<button type="button" class="road__step" data-s="' + si + '"><span class="road__num">0' + (si + 1) + '</span><span class="road__lbl"><b>' + s.w.t + '</b><small>' + s.w.hz + '</small></span><span class="road__cnt" data-cnt="' + si + '">0/' + s.acts.length + '</span></button>';
    }).join('') + '</div><div class="road__ctrl"><button type="button" class="road__arrow" data-go="-1" aria-label="Etapa anterior">' + ARROW('M15 18l-6-6 6-6') + '</button><button type="button" class="road__arrow" data-go="1" aria-label="Etapa siguiente">' + ARROW('M9 18l6-6-6-6') + '</button></div></nav>';
    var body = '<div class="road__stages">' + stages.map(function (s, si) {
      return '<section class="stage" data-s="' + si + '" aria-labelledby="st' + si + '">' +
        '<header class="stage__h"><span class="stage__k">Etapa ' + (si + 1) + ' de ' + stages.length + ' · ' + s.w.hz + '</span><h4 id="st' + si + '">' + s.w.t + '</h4>' +
        '<div class="stage__meter" aria-hidden="true"><i data-m="' + si + '"></i></div></header>' +
        '<ul class="stage__acts">' + s.acts.map(function (a, ai) {
          var id = 'a' + si + '-' + ai;
          return '<li class="st" style="--d:' + ai + '"><label class="act' + (a.pri ? ' pri' : '') + '" for="' + id + '"><input type="checkbox" id="' + id + '" data-s="' + si + '">' +
            '<span class="act__box" aria-hidden="true">' + CHECK + '</span><span class="act__body"><span class="act__t">' + esc(a.t) + '</span><small>' + esc(DIMS.filter(function (x) { return x.k === a.k; })[0].n) + '</small></span>' +
            (a.pri ? '<span class="act__tag">Prioridad</span>' : '') + '</label></li>';
        }).join('') + '</ul>' + '</section>';
    }).join('') + '</div>';
    $('road').innerHTML = nav + body;
    roadActive = -1;
    roadCount();
    roadSync();
    if (roadActive < 0) roadSet(0);
  }
  function roadCount() {
    var total = 0, done = 0;
    WAVES.forEach(function (w, si) {
      var bx = $('road').querySelectorAll('input[data-s="' + si + '"]'), c = 0;
      forEach(bx, function (b) { if (b.checked) c++; });
      total += bx.length; done += c;
      var full = c === bx.length && c > 0;
      $('road').querySelector('[data-cnt="' + si + '"]').textContent = c + '/' + bx.length;
      $('road').querySelector('[data-m="' + si + '"]').style.width = (bx.length ? c / bx.length * 100 : 0) + '%';
      $('road').querySelector('.stage[data-s="' + si + '"]').classList.toggle('is-done', full);
      $('road').querySelector('.road__step[data-s="' + si + '"]').classList.toggle('is-done', full);
    });
    $('roadTotal').innerHTML = '<b>' + done + '</b> de ' + total + ' acciones listas';
  }
  $('road').addEventListener('change', function (e) { if (e.target.matches('input[type=checkbox]')) roadCount(); });

  var roadActive = -1, roadTick = false;
  function roadSet(si) {
    roadActive = si;
    forEach($('road').querySelectorAll('.road__step'), function (b) {
      var k = +b.getAttribute('data-s');
      b.classList.toggle('is-on', k === si);
      b.classList.toggle('is-past', k < si);
      if (k === si) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    forEach($('road').querySelectorAll('.stage'), function (s) { s.classList.toggle('is-on', +s.getAttribute('data-s') === si); });
    var a = $('road').querySelectorAll('.road__arrow');
    if (a.length) { a[0].disabled = si === 0; a[1].disabled = si === WAVES.length - 1; }
  }
  function roadGo(si) {
    si = Math.max(0, Math.min(WAVES.length - 1, si));
    var st = $('road').querySelector('.stage[data-s="' + si + '"]');
    if (!st) return;
    roadSet(si);
    var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
    var mobile = window.matchMedia('(max-width: 860px)').matches;
    var extra = mobile ? $('road').querySelector('.road__nav').offsetHeight + 28 : 40;
    roadLock = Date.now() + 900;
    window.scrollTo({ top: st.getBoundingClientRect().top + window.pageYOffset - navH - extra, behavior: scrollBeh() });
  }
  var roadLock = 0;
  $('road').addEventListener('click', function (e) {
    var b = e.target.closest('.road__step'); if (b) { roadGo(+b.getAttribute('data-s')); return; }
    var g = e.target.closest('.road__arrow'); if (g && !g.disabled) roadGo(roadActive + +g.getAttribute('data-go'));
  });
  function roadSync() {
    roadTick = false;
    var box = $('road').querySelector('.road__stages'); if (!box) return;
    var vh = window.innerHeight, mid = vh * 0.45, best = 0, bestD = Infinity;
    forEach(box.querySelectorAll('.stage'), function (s, si) {
      var b = s.getBoundingClientRect();
      var dd = b.top > mid ? b.top - mid : b.bottom < mid ? mid - b.bottom : 0;
      if (dd < bestD) { bestD = dd; best = si; }
      if (b.top < vh * 0.88) s.classList.add('is-vis');
    });
    if (best !== roadActive && Date.now() > roadLock) roadSet(best);
    var bb = box.getBoundingClientRect(), p = (mid - bb.top) / Math.max(1, bb.height);
    $('road').style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
  }
  window.addEventListener('scroll', function () { if (!roadTick) { roadTick = true; requestAnimationFrame(roadSync); } }, { passive: true });
  window.addEventListener('resize', roadSync);

  function tiersRec(r, d) {
    var pick = AE.tierRecomendada(r);
    var why = AE.motivoTier(pick);
    forEach(document.querySelectorAll('.tier'), function (t) {
      var on = +t.getAttribute('data-tier') === pick, rec = t.querySelector('.tier__rec');
      t.classList.toggle('is-rec', on);
      rec.hidden = !on;
      if (on) rec.innerHTML = '<b>' + (d.sample ? 'Recomendado para el reporte de ejemplo' : 'Recomendado para tu resultado') + '</b>' + why;
    });
  }

  var rvIO = null;
  if (!RM_REDUCE && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('ae-anim');
    rvIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-vis');
          marcarInerte(e.target, false);
          rvIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  }
  function rvReset() {
    var anim = document.documentElement.classList.contains('ae-anim');
    forEach(document.querySelectorAll('.ae-rv'), function (el) {
      if (el.closest('#reporte')) el.classList.remove('is-vis');
      if (!anim) marcarInerte(el, false);
      else marcarInerte(el, !el.classList.contains('is-vis'));
      if (rvIO) rvIO.observe(el);
    });
  }
  function prepararImpresion() {
    document.documentElement.classList.add('ae-print');
    $('reporte').classList.add('is-in');
    forEach(document.querySelectorAll('.ae-rv, .stage'), function (el) {
      el.classList.add('is-vis');
      el.inert = false;
    });
  }
  window.addEventListener('beforeprint', prepararImpresion);
  window.addEventListener('afterprint', function () { document.documentElement.classList.remove('ae-print'); });

  function drawRadar(r) {
    var cx = 200, cy = 170, R = 112, n = DIMS.length;
    var pt = function (k, s) { var a = -Math.PI / 2 + k * 2 * Math.PI / n; return [cx + R * s / 100 * Math.cos(a), cy + R * s / 100 * Math.sin(a)]; };
    var poly = function (vals) { return vals.map(function (v, k) { return pt(k, v).map(function (x) { return x.toFixed(1); }).join(','); }).join(' '); };
    var g = '';
    [25, 75, 100].forEach(function (v) { g += '<polygon class="r-grid" points="' + poly(DIMS.map(function () { return v; })) + '"/>'; });
    g += '<polygon class="r-grid mid" points="' + poly(DIMS.map(function () { return 50; })) + '"/>';
    DIMS.forEach(function (D, k) {
      var p = pt(k, 100);
      g += '<line class="r-axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>';
      var l = pt(k, 118), lx = l[0], ly = l[1];
      var anc = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
      var dy = Math.abs(lx - cx) < 4 ? (ly < cy ? -16 : 12) : -4;
      g += '<text class="r-lbl" x="' + lx.toFixed(1) + '" y="' + (ly + dy).toFixed(1) + '" text-anchor="' + anc + '"><tspan x="' + lx.toFixed(1) + '">' + D.l[0] + '</tspan><tspan x="' + lx.toFixed(1) + '" dy="14">' + D.l[1] + '</tspan></text>';
    });
    [25, 50, 75].forEach(function (v) { var p = pt(0, v); g += '<text class="r-tick" x="' + (p[0] + 4).toFixed(1) + '" y="' + (p[1] + 3).toFixed(1) + '">' + v + '</text>'; });
    g += '<polygon class="r-area" points="' + poly(r.dims.map(function (x) { return Math.max(x.s, 2); })) + '"/>';
    r.dims.forEach(function (x, k) { var p = pt(k, Math.max(x.s, 2)); g += '<circle class="r-pt" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"/>'; });
    $('radar').innerHTML = g;
    $('radar').setAttribute('aria-label', AE.etiquetaRadar(r));
  }

  var tip = $('tip'), rep = $('reporte');
  function showTip(e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || !rep.contains(t)) { tip.classList.remove('show'); return; }
    var b = t.getBoundingClientRect(), rb = rep.getBoundingClientRect();
    tip.textContent = t.getAttribute('data-tip');
    var x = Math.max(130, Math.min(rb.width - 130, b.left + b.width / 2 - rb.left));
    tip.style.left = x + 'px';
    tip.style.top = (b.top - rb.top) + 'px';
    tip.classList.add('show');
  }
  rep.addEventListener('pointerover', showTip);
  rep.addEventListener('pointerleave', function () { tip.classList.remove('show'); });
  rep.addEventListener('click', showTip);

  var ans = {};
  var key = function (s) { return s.p === 'm' ? 'm' + STEPS.indexOf(s) : s.k; };
  function q(focus) {
    var i = navQ.indice();
    var s = STEPS[i];
    $('qPart').textContent = s.p === 'm' ? 'Parte 1 de 2 · ' + DIMS[s.d].n : 'Parte 2 de 2 · Tu caso de uso principal';
    $('qCount').textContent = (i + 1) + ' de ' + STEPS.length;
    var track = $('qTrack');
    track.setAttribute('aria-valuenow', String(i + 1));
    track.setAttribute('aria-valuetext', (i + 1) + ' de ' + STEPS.length);
    $('qProg').style.width = (i / STEPS.length * 100) + '%';
    $('qText').textContent = s.t;
    $('qHelp').textContent = s.h || '';
    $('qHelp').hidden = !s.h;
    if (anuncioI !== i) {
      anuncioI = i;
      $('qLive').textContent = 'Pregunta ' + (i + 1) + ' de ' + STEPS.length + '. ' + s.t + (s.h ? ' ' + s.h : '');
    }
    var box = $('qOpts');
    box.innerHTML = '';
    if (s.h) box.setAttribute('aria-describedby', 'qHelp'); else box.removeAttribute('aria-describedby');
    if (s.type === 'text') {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'quiz__input'; inp.maxLength = 80; inp.placeholder = 'Describe tu caso de uso'; inp.autocomplete = 'off';
      inp.setAttribute('aria-labelledby', 'q-title');
      if (s.h) inp.setAttribute('aria-describedby', 'qHelp');
      inp.value = ans.name || '';
      inp.addEventListener('input', function () { ans.name = inp.value.trim(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('qNext').click(); } });
      box.appendChild(inp);
      $('qNext').disabled = false;
      if (focus) inp.focus();
    } else {
      s.o.forEach(function (txt, k) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'opt';
        b.setAttribute('aria-pressed', ans[key(s)] === k + 1 ? 'true' : 'false');
        b.innerHTML = '<span class="opt__k" aria-hidden="true">' + 'ABCDEF'[k] + '</span><span></span>';
        b.lastChild.textContent = txt;
        b.addEventListener('click', function () {
          ans[key(s)] = k + 1;
          navQ.programar(window.setTimeout, window.clearTimeout, 200, function () { q(true); });
          q(true);
        });
        box.appendChild(b);
      });
      $('qNext').disabled = !ans[key(s)];
      if (focus) { var sel = box.querySelector('[aria-pressed="true"]') || box.firstChild; if (sel) sel.focus({ preventScroll: true }); }
    }
    $('qBack').disabled = i === 0;
    $('qNext').textContent = i === STEPS.length - 1 ? 'Ver mi reporte' : 'Siguiente';
  }
  $('qOpts').addEventListener('keydown', function (e) {
    var dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    var btns = Array.prototype.filter.call($('qOpts').querySelectorAll('.opt'), function () { return true; });
    var idx = btns.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    btns[(idx + dir + btns.length) % btns.length].focus();
  });
  function armarRespuestas() {
    return {
      m: STEPS.filter(function (s) { return s.p === 'm'; }).map(function (s) { return ans[key(s)]; }),
      name: ans.name || '',
      proc: ans.proc, aut: ans.aut, pres: ans.pres, datos: ans.datos, afect: ans.afect,
      area: typeof ans.area === 'number' ? ans.area - 1 : NaN,
      org: '',
      sample: false
    };
  }
  function indiceFaltante() {
    for (var n = 0; n < STEPS.length; n++) {
      var s = STEPS[n];
      if (s.type === 'text') continue;
      if (!ans[key(s)]) return n;
    }
    return -1;
  }
  $('qNext').addEventListener('click', function () {
    if (navQ.indice() < STEPS.length - 1) {
      if ($('qNext').disabled) return;
      navQ.siguiente(window.clearTimeout);
      q(true);
      return;
    }
    navQ.cancelar(window.clearTimeout);
    var falta = indiceFaltante();
    if (falta >= 0) {
      navQ.fijar(falta, window.clearTimeout);
      q(true);
      $('qLive').textContent = 'Falta una respuesta antes de ver el reporte. ' + $('qLive').textContent;
      return;
    }
    var d = armarRespuestas();
    if (!AE.entradasValidas(d) || !render(d)) {
      $('qLive').textContent = 'No se pudo armar el reporte porque falta una respuesta válida.';
      return;
    }
    $('qProg').style.width = '100%';
    $('qBody').hidden = true;
    $('qDone').hidden = false;
    rep.scrollIntoView({ behavior: scrollBeh(), block: 'start' });
    rep.focus({ preventScroll: true });
  });
  $('qBack').addEventListener('click', function () {
    if (navQ.indice() > 0) { navQ.anterior(window.clearTimeout); q(true); }
  });
  $('qRestart').addEventListener('click', function () {
    navQ.reiniciar(window.clearTimeout);
    ans = {};
    anuncioI = -1;
    $('qBody').hidden = false;
    $('qDone').hidden = true;
    q(true);
    rep.classList.add('is-stale');
    rep.classList.remove('is-in');
    $('ribbon').textContent = 'Resultado anterior';
    $('ribbon').classList.remove('is-yours');
    $('rStale').hidden = false;
    pendiente = { sample: false, stale: true, msg: '', gs: null };
    consentimiento('anterior');
    $('cuestionario').scrollIntoView({ behavior: scrollBeh(), block: 'start' });
  });
  $('printBtn').addEventListener('click', function () {
    prepararImpresion();
    window.print();
  });
  $('waIncluir').addEventListener('change', aplicarWhatsapp);

  var flotante = document.querySelector('.wa-float');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var on = es[0].isIntersecting;
      document.body.classList.toggle('ae-quiz-on', on);
      marcarInerte(flotante, on);
    }, { threshold: .15 }).observe($('cuestionario'));
  }

  q();
  render(AE.SAMPLE);
})();
