(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce) document.documentElement.classList.add('reduce-motion');

  function svgPath(d) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"></path></svg>';
  }

  /* Cabecera: panel de servicios y menú móvil */
  var trig = document.getElementById('svc-btn');
  var panel = document.getElementById('panel-servicios');
  var backdrop = document.getElementById('svc-backdrop');
  function setPanel(open, focusBack) {
    if (!trig || !panel) return;
    trig.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
    var chev = trig.querySelector('.chev');
    if (chev) chev.classList.toggle('up', open);
    if (!open && focusBack) trig.focus();
  }
  if (trig && panel) {
    trig.addEventListener('click', function () { setPanel(panel.hidden); });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); setPanel(false, true); }
    });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setPanel(false); });
  }
  if (backdrop) backdrop.addEventListener('click', function () { setPanel(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (panel && !panel.hidden) setPanel(false, true);
    if (menu && !menu.hidden) setMenu(false);
  });
  document.addEventListener('click', function (e) {
    if (!panel || panel.hidden) return;
    if (!panel.contains(e.target) && trig && !trig.contains(e.target)) setPanel(false);
  });

  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu-movil');
  var mmClose = document.getElementById('mm-close');
  var mmFirst = mmClose;
  var mmLast = document.getElementById('mm-last');
  function setMenu(open) {
    if (!menu || !burger) return;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open && mmFirst) mmFirst.focus();
    if (!open) burger.focus();
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { setMenu(true); });
    if (mmClose) mmClose.addEventListener('click', function () { setMenu(false); });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return; }
      if (e.key !== 'Tab' || !mmFirst || !mmLast) return;
      var act = document.activeElement;
      if (e.shiftKey && act === mmFirst) { e.preventDefault(); mmLast.focus(); }
      else if (!e.shiftKey && act === mmLast) { e.preventDefault(); mmFirst.focus(); }
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }
  var mmSvc = document.getElementById('mm-svc');
  var mmSub = document.getElementById('mm-servicios');
  if (mmSvc && mmSub) {
    mmSvc.addEventListener('click', function () {
      var open = mmSub.hidden;
      mmSub.hidden = !open;
      mmSvc.setAttribute('aria-expanded', open ? 'true' : 'false');
      var chev = mmSvc.querySelector('.chev');
      if (chev) chev.classList.toggle('up', open);
    });
  }

  /* Pestañas de fase (inicio) */
  document.querySelectorAll('[data-phases]').forEach(function (root) {
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = [].slice.call(root.querySelectorAll('[role="tabpanel"]'));
    var prev = root.querySelector('[data-ph-prev]');
    var next = root.querySelector('[data-ph-next]');
    var prevT = root.querySelector('[data-ph-prev-t]');
    var nextT = root.querySelector('[data-ph-next-t]');
    function show(i, focus) {
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panels[n]) panels[n].hidden = !on;
      });
      if (prev) {
        prev.classList.toggle('hide', i === 0);
        prev.disabled = i === 0;
      }
      if (next) {
        next.classList.toggle('hide', i === tabs.length - 1);
        next.disabled = i === tabs.length - 1;
      }
      if (prevT && i > 0) prevT.textContent = tabs[i - 1].getAttribute('data-label') || '';
      if (nextT && i < tabs.length - 1) nextT.textContent = tabs[i + 1].getAttribute('data-label') || '';
      if (focus && tabs[i]) tabs[i].focus();
    }
    var cur = 0;
    tabs.forEach(function (t, i) { if (t.getAttribute('aria-selected') === 'true') cur = i; });
    show(cur, false);
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { cur = i; show(i, false); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        cur = n;
        show(n, true);
      });
    });
    if (prev) prev.addEventListener('click', function () { if (cur > 0) { cur -= 1; show(cur, true); } });
    if (next) next.addEventListener('click', function () { if (cur < tabs.length - 1) { cur += 1; show(cur, true); } });
    function fromHash() {
      var m = (location.hash || '').match(/^#fase-0([1-4])$/);
      if (!m) return;
      cur = +m[1] - 1;
      show(cur, false);
      var el = document.getElementById('modelo');
      if (el) el.scrollIntoView();
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
    document.querySelectorAll('a[href^="#fase-0"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var m = (a.getAttribute('href') || '').match(/#fase-0([1-4])$/);
        if (!m) return;
        e.preventDefault();
        cur = +m[1] - 1;
        show(cur, false);
        var el = document.getElementById('modelo');
        if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        history.replaceState(null, '', '#fase-0' + m[1]);
      });
    });
  });

  /* Carrusel de situaciones */
  document.querySelectorAll('[data-carousel]').forEach(function (tr) {
    var prev = document.querySelector('[data-car-prev]');
    var next = document.querySelector('[data-car-next]');
    var pos = document.querySelector('[data-car-pos]');
    var mat = document.querySelector('[data-mat]');
    function step() {
      if (!tr.children || tr.children.length < 2) return 300;
      return tr.children[1].offsetLeft - tr.children[0].offsetLeft || 300;
    }
    function upd() {
      if (!tr.children || !tr.children.length) return;
      var n = tr.children.length;
      var st = step();
      var vis = Math.max(1, Math.round(tr.clientWidth / st));
      var atEnd = tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 2;
      var i = atEnd ? n - vis : Math.round(tr.scrollLeft / st);
      if (i < 0) i = 0;
      var last = Math.min(n, i + vis);
      if (pos) pos.textContent = (vis > 1 ? (i + 1) + ' a ' + last : String(i + 1)) + ' de ' + n;
      if (mat) mat.style.width = Math.round(last / n * 100) + '%';
      if (prev) prev.disabled = tr.scrollLeft <= 2;
      if (next) next.disabled = atEnd;
    }
    function scr(d) { tr.scrollBy({ left: d * step(), behavior: reduce ? 'auto' : 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { scr(-1); });
    if (next) next.addEventListener('click', function () { scr(1); });
    tr.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scr(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); scr(-1); }
    });
    tr.addEventListener('scroll', function () { window.requestAnimationFrame(upd); });
    window.addEventListener('resize', upd);
    upd();
  });

  /* Panel keynote reutilizable */
  var PLAY = 'M8 5v14l11-7z';
  var PAUSE = 'M7 5h4v14H7zM13 5h4v14h-4z';
  document.querySelectorAll('[data-keynote]').forEach(function (root) {
    var panes = [].slice.call(root.querySelectorAll('[data-kn-pane]'));
    var copies = [].slice.call(root.querySelectorAll('[data-kn-copy]'));
    var gos = [].slice.call(root.querySelectorAll('[data-kn-go]'));
    var prev = root.querySelector('[data-kn-prev]');
    var next = root.querySelector('[data-kn-next]');
    var play = root.querySelector('[data-kn-play]');
    var n = Math.max(panes.length, copies.length, gos.length);
    if (!n) return;
    var i = 0;
    var paused = false;
    var timer = 0;
    function dur(idx) {
      var el = panes[idx] || copies[idx];
      var ms = el && el.getAttribute('data-ms');
      if (ms) return +ms;
      return +(root.getAttribute('data-ms') || 8000);
    }
    function restartAnim(el) {
      if (!el) return;
      el.classList.remove('kn-in');
      void el.offsetWidth;
      el.classList.add('kn-in');
      var bar = el.querySelector('.kn-pr');
      if (bar) {
        bar.style.animationDuration = dur(i) + 'ms';
        bar.classList.toggle('paused', paused || reduce);
      }
    }
    function show(idx) {
      i = (idx + n) % n;
      panes.forEach(function (el, k) { el.hidden = k !== i; });
      copies.forEach(function (el, k) {
        el.hidden = k !== i;
        if (k === i) restartAnim(el);
      });
      gos.forEach(function (el, k) {
        var on = k === i;
        el.classList.toggle('on', on);
        if (on) el.setAttribute('aria-current', 'step');
        else el.removeAttribute('aria-current');
        var pr = el.querySelector('.cl-pr');
        if (pr) {
          pr.hidden = !on;
          pr.style.animationDuration = dur(i) + 'ms';
          pr.classList.toggle('paused', paused || reduce);
        }
      });
      root.querySelectorAll('video').forEach(function (v) {
        var pane = v.closest('[data-kn-pane]');
        var active = pane && !pane.hidden;
        if (reduce || paused || !active) { try { v.pause(); } catch (e) {} }
        else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
      arm();
    }
    function arm() {
      clearTimeout(timer);
      if (reduce || paused) return;
      timer = setTimeout(function () { show(i + 1); }, dur(i));
    }
    function setPaused(v) {
      paused = v;
      if (play) {
        play.setAttribute('aria-pressed', paused ? 'true' : 'false');
        play.setAttribute('aria-label', paused ? 'Reproducir el recorrido' : 'Pausar el recorrido');
        play.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + (paused ? PLAY : PAUSE) + '"></path></svg>';
      }
      root.classList.toggle('is-paused', paused);
      var cur = copies[i];
      if (cur) {
        var bar = cur.querySelector('.kn-pr');
        if (bar) bar.classList.toggle('paused', paused || reduce);
      }
      var g = gos[i] && gos[i].querySelector('.cl-pr');
      if (g) g.classList.toggle('paused', paused || reduce);
      root.querySelectorAll('.clw').forEach(function (w) { w.classList.toggle('paused', paused || reduce); });
      if (paused) {
        root.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
        clearTimeout(timer);
      } else show(i);
    }
    if (prev) prev.addEventListener('click', function () { show(i - 1); });
    if (next) next.addEventListener('click', function () { show(i + 1); });
    if (play) play.addEventListener('click', function () { setPaused(!paused); });
    gos.forEach(function (el, k) {
      el.addEventListener('click', function () { show(k); });
    });
    root.querySelectorAll('[data-kn-jump]').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = +el.getAttribute('data-kn-jump');
        if (!isNaN(k)) show(k);
      });
    });
    var zoom = root.querySelector('[data-kn-zoom]');
    var lb = document.getElementById('clip-lb');
    if (zoom && lb) {
      zoom.addEventListener('click', function () {
        var pane = panes[i];
        var v = pane && pane.querySelector('video');
        var slot = lb.querySelector('[data-lb-slot]');
        var cap = lb.querySelector('[data-lb-cap]');
        if (slot) {
          slot.innerHTML = '';
          if (v) {
            var nv = v.cloneNode(true);
            nv.controls = true;
            nv.muted = true;
            nv.loop = true;
            nv.autoplay = !reduce;
            slot.appendChild(nv);
            if (!reduce) { var p = nv.play(); if (p && p.catch) p.catch(function () {}); }
          }
        }
        if (cap) cap.textContent = zoom.getAttribute('data-cap') || (copies[i] ? copies[i].innerText.replace(/\s+/g, ' ').trim().slice(0, 180) : '');
        lb.hidden = false;
        setPaused(true);
        var x = lb.querySelector('[data-lb-x]');
        if (x) x.focus();
      });
    }
    show(0);
    if (reduce) setPaused(true);
  });

  var lb = document.getElementById('clip-lb');
  if (lb) {
    function closeLb() {
      lb.hidden = true;
      var slot = lb.querySelector('[data-lb-slot]');
      if (slot) slot.innerHTML = '';
      var z = document.querySelector('[data-kn-zoom]');
      if (z) z.focus();
    }
    var x = lb.querySelector('[data-lb-x]');
    if (x) x.addEventListener('click', closeLb);
    lb.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closeLb(); } });
  }

  /* Figuras con «+» */
  document.querySelectorAll('[data-figuras]').forEach(function (root) {
    var items = [].slice.call(root.querySelectorAll('.cw')).filter(function (it) { return it.querySelector('.plus'); });
    function closeAll() {
      items.forEach(function (it) {
        var b = it.querySelector('.cmp');
        var plus = it.querySelector('.plus');
        var pop = it.querySelector('.pop');
        if (b) b.setAttribute('aria-pressed', 'false');
        if (plus) { plus.hidden = true; plus.setAttribute('aria-expanded', 'false'); }
        if (pop) pop.hidden = true;
      });
    }
    items.forEach(function (it) {
      var b = it.querySelector('.cmp');
      var plus = it.querySelector('.plus');
      var pop = it.querySelector('.pop');
      var xb = pop && pop.querySelector('.pop-x');
      if (b) b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') === 'true';
        closeAll();
        if (!on) {
          b.setAttribute('aria-pressed', 'true');
          if (plus) plus.hidden = false;
        }
      });
      if (plus && pop) {
        plus.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = pop.hidden;
          items.forEach(function (o) { var p = o.querySelector('.pop'); if (p && p !== pop) p.hidden = true; var pl = o.querySelector('.plus'); if (pl && pl !== plus) pl.setAttribute('aria-expanded', 'false'); });
          pop.hidden = !open;
          plus.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open && xb) xb.focus();
          if (!open) plus.focus();
        });
        pop.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pop.hidden = true; plus.setAttribute('aria-expanded', 'false'); plus.focus(); }
        });
        if (xb) xb.addEventListener('click', function () { pop.hidden = true; plus.setAttribute('aria-expanded', 'false'); plus.focus(); });
      }
    });
  });

  /* Cola de aprobación (ficha agentes) */
  document.querySelectorAll('[data-cola]').forEach(function (root) {
    var paused = false;
    var log = root.querySelector('[data-log]');
    var status = root.querySelector('[data-status]');
    var pauseBtn = root.querySelector('[data-pause]');
    var banner = root.querySelector('[data-paused-banner]');
    function stamp() {
      var n = log ? log.children.length : 3;
      var m = 47 + Math.max(0, n - 3);
      return '10:' + String(Math.min(m, 59)).padStart(2, '0');
    }
    function addLog(who, text) {
      if (!log) return;
      var li = document.createElement('li');
      li.innerHTML = '<span class="num mono"></span><span><b style="color:#26262C;font-weight:500"></b> </span>';
      li.querySelector('.num').textContent = stamp();
      li.querySelector('b').textContent = who;
      li.querySelector('span:last-child').appendChild(document.createTextNode(' ' + text));
      log.appendChild(li);
    }
    function refresh() {
      var left = root.querySelectorAll('[data-task][data-state="pend"]').length;
      if (status) status.textContent = paused
        ? 'Proceso en pausa. Los agentes no toman tareas nuevas y lo pendiente pasa a la cola de tu equipo.'
        : (left ? 'Proceso en marcha. Hay tareas esperando tu decisión.' : 'No quedan tareas esperando tu decisión.');
      if (banner) banner.hidden = !paused;
      if (pauseBtn) pauseBtn.textContent = paused ? 'Reanudar el proceso' : 'Pausar el proceso';
      root.querySelectorAll('[data-task] button').forEach(function (b) { b.disabled = paused; });
    }
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      addLog('Tú', paused ? 'Pausaste el proceso.' : 'Reanudaste el proceso.');
      refresh();
    });
    root.querySelectorAll('[data-task]').forEach(function (task) {
      var name = task.getAttribute('data-name') || '';
      task.querySelectorAll('button[data-dec]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (paused || task.getAttribute('data-state') !== 'pend') return;
          var ok = b.getAttribute('data-dec') === 'ok';
          task.setAttribute('data-state', 'done');
          var acts = task.querySelector('.qi-a');
          if (acts) acts.innerHTML = '<span class="st-dot ' + (ok ? 'ok' : 'wait') + '">' + (ok ? 'Aprobada por ti' : 'Devuelta a la cola') + '</span>';
          addLog('Tú', (ok ? 'Aprobaste «' : 'Devolviste «') + name + '».');
          refresh();
        });
      });
    });
    var reset = root.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', function () { window.location.reload(); });
    refresh();
  });

})();
