/* ÓNIX v3 · scroll motion layer (vanilla, no dependencies).
   Runs only when <html> has the .js class (set in <head> when
   prefers-reduced-motion is not "reduce"). Animates transform/opacity/filter only. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, w = window;
  if (!root.classList.contains('js')) return;

  var mqReduce = w.matchMedia('(prefers-reduced-motion: reduce)');
  var mqDesk = w.matchMedia('(min-width: 901px)');
  var supportsScrollTL = w.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
  var supportsViewTL = w.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* If the user switches to reduced motion mid-session, drop everything to final state. */
  mqReduce.addEventListener && mqReduce.addEventListener('change', function (q) { if (q.matches) root.classList.remove('js'); });

  /* ── Scroll progress bar ─────────────────────────────── */
  var bar = d.createElement('div');
  bar.className = 'scrollbar';
  bar.setAttribute('aria-hidden', 'true');
  d.body.appendChild(bar);
  if (supportsScrollTL) bar.classList.add('is-css');

  /* ── Reveal (IntersectionObserver, batch stagger) ─────── */
  var revealEls = d.querySelectorAll('.reveal, .h2, .strip li');
  if ('IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.style.setProperty('--bd', String(k++ * (el.matches('.strip li') ? 420 : 90)));
        el.classList.add('is-in');
        io.unobserve(el);
        if (el.matches('.facts li')) countUp(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── Case: count up only clean numeric values (ends on the exact original) ── */
  function countUp(li) {
    var el = li.querySelector('.count[data-to]');
    if (!el || el.dataset.done) return;
    el.dataset.done = '1';
    var to = parseInt(el.getAttribute('data-to'), 10), orig = el.textContent;
    if (!isFinite(to) || String(to) !== orig.trim()) return;
    var t0 = null, dur = 1200;
    el.setAttribute('aria-hidden', 'true');
    function step(ts) {
      if (t0 === null) t0 = ts;
      var t = clamp((ts - t0) / dur, 0, 1);
      el.textContent = t < 1 ? String(Math.round(to * easeOut(t))) : orig;
      if (t < 1) requestAnimationFrame(step); else el.removeAttribute('aria-hidden');
    }
    setTimeout(function () { requestAnimationFrame(step); }, 250);
  }

  /* ── Hero: 4-step progress sequence ──────────────────── */
  var steps = d.querySelectorAll('.method__step');
  function runSteps(base) {
    steps.forEach(function (s, i) { setTimeout(function () { s.classList.add('is-active'); }, base + i * 480); });
  }
  var methodEl = d.querySelector('.method');
  if (methodEl && 'IntersectionObserver' in w) {
    var mio = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      mio.disconnect();
      // on first paint the panel is still rising in: wait for it; later (scrolled into view) start sooner
      runSteps(performance.now() < 1500 ? 750 : 200);
    }, { threshold: 0.35 });
    mio.observe(methodEl);
  } else runSteps(750);

  /* ── Cómo pensamos: line draw (CSS view() timeline, JS fallback) ── */
  var think = d.querySelector('.think__grid');
  if (think && supportsViewTL) think.classList.add('is-css');

  /* ── Atención con IA scene: toggle (WhatsApp / voz) + click-to-advance ── */
  var product = d.querySelector('.product');
  var stage = product && product.querySelector('.sa-stage');
  var devices = product && product.querySelector('.sa-devices');
  var tablist = product && product.querySelector('.sa-tabs');
  var tabs = tablist ? Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]')) : [];
  var panelWa = d.getElementById('sa-panel-wa'), panelCall = d.getElementById('sa-panel-call');
  var chat = d.getElementById('sa-chat'), call = d.getElementById('sa-call');
  var btnNext = d.getElementById('sa-next'), endBox = d.getElementById('sa-end');
  var btnRestart = d.getElementById('sa-restart'), btnToVoice = d.getElementById('sa-tovoice');
  var timerEl = call && call.querySelector('.call__timer');
  var caps = call ? Array.prototype.slice.call(call.querySelectorAll('.cap')) : [];
  var current = 'wa', busy = false, queued = false, pending = [], timerId = 0, timerStart = 0;
  var autoOn = false, autoTimer = 0;   // autoplay starts when the section enters the viewport
  var sticky = product && product.querySelector('.sa-sticky');
  // touch phones/tablets: the stage pins and scroll position drives the conversation (no autoplay there)
  var mqPin = w.matchMedia('(max-width: 900px) and (pointer: coarse)');
  var pinMode = false, pinRendered = false, pinS = -1, pinKey = '';
  var PIN_N = 7, PIN_HOLD = 0.6;       // 7 scroll steps (CSS: 40svh each) + a short hold after the last message
  var trackStart = 0, stepPx = 1;

  // WhatsApp steps: each step = one message; replies (inside .turn) show typing dots first
  var waSteps = chat ? Array.prototype.map.call(chat.children, function (node) {
    return node.classList.contains('turn')
      ? { msg: node.querySelector('.msg'), typing: node.querySelector('.typing') }
      : { msg: node, typing: null };
  }) : [];
  PIN_N = Math.max(3, waSteps.length - 1);   // scroll steps follow the number of WhatsApp messages (was 7 for 8 messages)
  var pill = chat && chat.querySelector('.pill');
  var waK = 0, callStage = 0, callC = 0;   // callStage: 0 ringing, 1 answered

  function wait(ms, fn) { pending.push(setTimeout(fn, ms)); }
  function cancelPending() { pending.forEach(clearTimeout); pending = []; busy = false; queued = false; }
  function release() { busy = false; if (queued) { queued = false; advance(); } }
  function isDone() { return current === 'wa' ? waK >= waSteps.length : (callStage === 1 && callC >= caps.length); }
  function scheduleAuto(ms) {
    clearTimeout(autoTimer);
    if (!autoOn) return;
    autoTimer = setTimeout(function tickAuto() {
      if (isDone()) return;
      if (busy) { autoTimer = setTimeout(tickAuto, 250); return; }
      advance();
    }, ms);
  }
  function fmt(sec) { return ('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + sec % 60).slice(-2); }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = 0; } }
  function startTimer() {
    stopTimer(); timerStart = Date.now();
    if (timerEl) timerEl.textContent = '00:00';
    timerId = setInterval(function () { if (timerEl) timerEl.textContent = fmt(Math.floor((Date.now() - timerStart) / 1000)); }, 1000);
  }

  function setEnd(done) {
    if (!btnNext) return;
    var hadFocus = d.activeElement === btnNext || (endBox && endBox.contains(d.activeElement));
    btnNext.hidden = done;
    endBox.hidden = !done;
    if (btnToVoice) btnToVoice.hidden = current !== 'wa';
    if (hadFocus) (done ? btnRestart : btnNext).focus({ preventScroll: true });
  }

  function resetWa() {
    waK = 1;
    waSteps.forEach(function (st, i) { st.msg.classList.toggle('on', i < 1); if (st.typing) st.typing.classList.remove('on'); });
    if (pill) pill.classList.remove('on');
    setShift(chat, null);
  }
  function resetCall() {
    callStage = 0; callC = 0; stopTimer();
    if (timerEl) timerEl.textContent = '00:00';
    call.classList.add('ringing'); call.classList.remove('answered', 'live');
    caps.forEach(function (c) { c.classList.remove('on', 'now'); });
    setShift(call.querySelector('.vchat'), null);
  }

  function playBubble(i) {
    var c = caps[i]; if (!c) return;
    caps.forEach(function (x) { x.classList.remove('now'); });
    c.classList.add('on', 'now');
    setShift(call.querySelector('.vchat'), c);   // keep the newest bubble in view (tap mode)
    call.classList.add('live');
    busy = true;
    wait(450, release);   // next tap allowed while this bubble keeps playing
    wait(1500, function () { c.classList.remove('now'); if (!call.querySelector('.cap.now')) call.classList.remove('live'); if (callC >= caps.length) setEnd(true); });
  }

  function advance() {
    if (busy) { queued = true; return; }
    stepOnce();
    if (!isDone()) scheduleAuto(current === 'wa' ? 1700 : (callC <= 1 ? 2900 : 2300));
  }
  function stepOnce() {
    if (current === 'wa') {
      if (waK >= waSteps.length) return;
      var st = waSteps[waK++], last = waK >= waSteps.length;
      busy = true;
      var show = function () {
        if (st.typing) st.typing.classList.remove('on');
        st.msg.classList.add('on');
        setShift(chat, chat.children[waSteps.indexOf(st)]);   // keep the newest message in view (tap mode)
        if (last && pill) wait(380, function () { pill.classList.add('on'); });
        if (last) wait(700, function () { busy = false; setEnd(true); }); else wait(150, release);
      };
      if (st.typing) { st.typing.classList.add('on'); wait(750, show); } else wait(100, show);
    } else {
      if (callStage === 0) {
        callStage = 1; call.classList.add('answered'); startTimer();
        busy = true;
        wait(600, function () { busy = false; callC = 1; playBubble(0); });   // the AI speaks first
      } else if (callC < caps.length) {
        callC++; playBubble(callC - 1);
      }
    }
  }

  function showChannel(ch, focusTab, fromUser) {
    cancelPending(); clearTimeout(autoTimer);
    current = ch;
    tablist.setAttribute('data-active', ch);
    tabs.forEach(function (t) {
      var sel = (t.id === 'sa-tab-call') === (ch === 'call');
      t.setAttribute('aria-selected', String(sel));
      t.tabIndex = sel ? 0 : -1;
      if (sel && focusTab) t.focus();
    });
    panelWa.classList.toggle('is-current', ch === 'wa');
    panelCall.classList.toggle('is-current', ch === 'call');
    if (ch === 'wa') { stopTimer(); resetWa(); } else resetCall();
    setEnd(false);
    if (pinMode) {
      // inside the pinned track: rewind to the start so the new conversation plays from its first message.
      // The stage is sticky, so this jump is invisible: only the conversation resets.
      var cs = pinProgress();
      if (fromUser && cs > 0 && cs < PIN_N + PIN_HOLD) jumpTo(trackStart);
      pinKey = ''; renderPin(pinProgress());
      return;
    }
    scheduleAuto(ch === 'wa' ? 900 : 1300);
  }

  if (tablist && panelWa && panelCall && chat && call) {
    panelWa.setAttribute('role', 'tabpanel'); panelWa.setAttribute('aria-labelledby', 'sa-tab-wa');
    panelCall.setAttribute('role', 'tabpanel'); panelCall.setAttribute('aria-labelledby', 'sa-tab-call');
    chat.setAttribute('aria-live', 'polite');
    call.querySelector('.vchat').setAttribute('aria-live', 'polite');
    showChannel('wa');
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { var ch = t.id === 'sa-tab-call' ? 'call' : 'wa'; if (ch !== current) showChannel(ch, false, true); });
      t.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        showChannel(tabs[j].id === 'sa-tab-call' ? 'call' : 'wa', true, true);
      });
    });
    devices.addEventListener('click', function () { if (pinMode) pinAdvance(); else advance(); });
    btnNext.addEventListener('click', function () { if (pinMode) pinAdvance(); else advance(); });
    btnRestart.addEventListener('click', function () { showChannel(current); btnNext.focus({ preventScroll: true }); });
    btnToVoice.addEventListener('click', function () { showChannel('call', true, true); });
  }

  /* ── Scroll-driven pin (touch, <= 900px) ── */
  function pinProgress() {
    var y = w.scrollY || w.pageYOffset;
    return clamp((y - trackStart) / stepPx, 0, PIN_N + PIN_HOLD);
  }
  function jumpTo(y) {
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    w.scrollTo(0, Math.round(y));
    root.style.scrollBehavior = prev;
  }
  function setShift(box, item) {
    var shift = 0;
    if (item) shift = Math.max(0, item.offsetTop + item.offsetHeight + 12 - box.clientHeight);
    box.style.setProperty('--sa-shift', (-shift) + 'px');
  }
  // event thresholds in step units: WhatsApp replies show typing dots first, then the message
  function waThreshold(j) { return j - 1 + (waSteps[j].typing ? 0.6 : 0.35); }
  var V_FIRST = 0.4;                     // voice: answer the call, then one bubble per step
  function voiceThreshold(e) { return V_FIRST + e * (PIN_N - 0.9) / caps.length; }   // e = 0 answer, 1..n bubbles
  function renderPin(sv) {
    pinS = sv;
    var key;
    if (current === 'wa') {
      var shown = 1, typingAt = -1;
      for (var j = 1; j < waSteps.length; j++) {
        if (sv >= waThreshold(j)) shown = j + 1;
        else { if (waSteps[j].typing && sv >= j - 1 + 0.1) typingAt = j; break; }
      }
      var pillOn = shown >= waSteps.length && sv >= waSteps.length - 2 + 0.85;
      key = 'wa|' + shown + '|' + typingAt + '|' + pillOn;
      if (key === pinKey) return;
      pinKey = key;
      waK = shown;
      waSteps.forEach(function (st, i) {
        st.msg.classList.toggle('on', i < shown);
        if (st.typing) st.typing.classList.toggle('on', i === typingAt);
      });
      if (pill) pill.classList.toggle('on', pillOn);
      var lastItem = chat.children[typingAt > 0 ? typingAt : shown - 1];
      setShift(chat, lastItem);
    } else {
      var answered = sv >= voiceThreshold(0), c = 0;
      for (var e = 1; e <= caps.length; e++) if (sv >= voiceThreshold(e)) c = e;
      var gap = (PIN_N - 0.9) / caps.length;
      var talking = c > 0 && sv < voiceThreshold(c) + gap * 0.8;
      var secs = answered ? Math.floor((sv - voiceThreshold(0)) / (PIN_N - voiceThreshold(0)) * 18) : 0;
      key = 'v|' + answered + '|' + c + '|' + talking + '|' + secs;
      if (key === pinKey) return;
      pinKey = key;
      callStage = answered ? 1 : 0; callC = c;
      call.classList.add('ringing');
      call.classList.toggle('answered', answered);
      call.classList.toggle('live', talking);
      caps.forEach(function (el, i) { el.classList.toggle('on', i < c); el.classList.toggle('now', talking && i === c - 1); });
      if (timerEl) timerEl.textContent = fmt(Math.min(secs, 18));
      setShift(call.querySelector('.vchat'), c > 0 ? caps[c - 1] : null);
    }
  }
  // tap on the phone while pinned: scroll forward to the next message (scroll stays the single source of truth)
  function pinAdvance() {
    var sv = pinProgress(), next = null, i;
    if (current === 'wa') { for (i = 1; i < waSteps.length; i++) if (waThreshold(i) > sv + 0.01) { next = waThreshold(i); break; } }
    else { for (i = 0; i <= caps.length; i++) if (voiceThreshold(i) > sv + 0.01) { next = voiceThreshold(i); break; } }
    if (next === null) return;
    w.scrollTo({ top: Math.round(trackStart + (next + 0.02) * stepPx), behavior: 'smooth' });
  }
  function measurePin() {
    if (!pinMode || !stage || !sticky) return;
    var y = w.scrollY || w.pageYOffset;
    var stickyTop = parseFloat(getComputedStyle(sticky).top) || 0;
    trackStart = stage.getBoundingClientRect().top + y - stickyTop;
    stepPx = Math.max(1, (stage.offsetHeight - sticky.offsetHeight) / (PIN_N + PIN_HOLD));
  }
  function applyMode() {
    if (!stage || !sticky || !chat || !call) return;
    var want = mqPin.matches && !stage.classList.contains('sa-static');
    if (want === pinMode && pinRendered) return;
    pinMode = want;
    product.classList.toggle('sa-pin', pinMode);
    clearTimeout(autoTimer); cancelPending(); stopTimer();
    if (pinMode) {
      autoOn = false;
      setEnd(false);
      measurePin(); pinKey = ''; renderPin(pinProgress()); pinRendered = true;
    } else {
      pinRendered = true;
      setShift(chat, null); setShift(call.querySelector('.vchat'), null);
      showChannel(current);
      if (stage.classList.contains('is-in')) { autoOn = false; startAuto(); }
    }
  }

  // mobile entrance: simple in-view reveal
  function startAuto() { if (autoOn) return; autoOn = true; scheduleAuto(700); }
  // safety net: if playback never gets going, show both conversations in their final state
  function revealAll() {
    if (!stage) return;
    clearTimeout(autoTimer); cancelPending();
    stage.classList.add('sa-static');
    if (pinMode) { pinMode = false; product.classList.remove('sa-pin'); }
    waK = waSteps.length; callStage = 1; callC = caps.length;
    if (call) { call.classList.add('ringing', 'answered'); call.classList.remove('live'); }
    if (pill) pill.classList.add('on');
    setEnd(true);
  }
  var watchdog = 0;
  function armWatchdog() {
    if (watchdog) return;
    watchdog = setTimeout(function () {
      var started = pinMode || waK > 1 || callStage > 0 || callC > 0;
      if (!started) revealAll();
    }, 5000);
  }
  if (stage && 'IntersectionObserver' in w) {
    var sio = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      stage.classList.add('is-in');
      if (pinMode) return;
      armWatchdog();
      if (en[0].intersectionRatio >= 0.3 || en[0].intersectionRect.height > w.innerHeight * 0.45) { startAuto(); sio.disconnect(); }
    }, { threshold: [0.15, 0.3, 0.5] });
    sio.observe(stage);
  } else if (stage) { stage.classList.add('is-in'); revealAll(); }

  /* ── Scroll loop (single rAF, passive listener, cached geometry) ── */
  var vh = w.innerHeight, heroEl = d.querySelector('.hero'), heroH = 0;
  var heroCopy = d.querySelector('.hero__copy'), method = d.querySelector('.method');
  var thinkTop = 0, docH = 0, stageTop = 0;
  var cur = { t: 0 }, target = { t: 0 }, ticking = false;
  function measure() {
    vh = w.innerHeight;
    var y = w.scrollY || w.pageYOffset;
    if (heroEl) heroH = heroEl.offsetHeight;
    if (think) thinkTop = think.getBoundingClientRect().top + y;
    if (stage) stageTop = stage.getBoundingClientRect().top + y;
    docH = root.scrollHeight;
    measurePin();
  }
  function tick(force) {
    ticking = false;
    var y = w.scrollY || w.pageYOffset;
    // progress bar fallback
    if (!supportsScrollTL) bar.style.transform = 'scaleX(' + clamp(y / Math.max(1, docH - vh), 0, 1) + ')';
    // hero parallax (desktop only, while hero is on screen)
    if (mqDesk.matches && y < heroH + 100) {
      if (heroCopy) heroCopy.style.setProperty('--py', (y * 0.14).toFixed(1) + 'px');
      if (method) method.style.setProperty('--py', (-y * 0.07).toFixed(1) + 'px');
    } else if (!mqDesk.matches && heroCopy) {
      heroCopy.style.removeProperty('--py'); method && method.style.removeProperty('--py');
    }
    // think line fallback
    if (think && !supportsViewTL) {
      var tp = clamp((y + vh - thinkTop - vh * 0.1) / (vh * 0.45), 0, 1);
      think.style.setProperty('--tp', tp.toFixed(3));
    }
    // Atención con IA on touch phones: pinned stage, scroll position drives the conversation
    if (pinMode) {
      if (!stage.classList.contains('is-in') && stage.getBoundingClientRect().top < vh * 0.92) stage.classList.add('is-in');
      renderPin(pinProgress());
    }
    // Atención con IA: 3D phone entrance tied to scroll (desktop only, no pin)
    if (devices && mqDesk.matches) {
      var top = stageTop - y;
      var p = clamp((vh - top) / (vh * 0.8), 0, 1);
      target.t = p;
      if (force) cur.t = p;
      animatePhone();
    }
  }
  var phoneRaf = 0;
  function animatePhone() {
    if (phoneRaf) return;
    phoneRaf = requestAnimationFrame(function loop() {
      phoneRaf = 0;
      cur.t += (target.t - cur.t) * 0.16;
      if (Math.abs(target.t - cur.t) < 0.0005) cur.t = target.t;
      var e = easeOut(cur.t);
      var s = devices.style;
      s.setProperty('--ty', ((1 - e) * 70).toFixed(2) + 'px');
      s.setProperty('--rx', ((1 - e) * 18).toFixed(2) + 'deg');
      s.setProperty('--ry', ((1 - e) * -16).toFixed(2) + 'deg');
      s.setProperty('--sc', (0.84 + 0.16 * e).toFixed(4));
      stage.style.setProperty('--glow', e.toFixed(3));
      if (cur.t !== target.t) phoneRaf = requestAnimationFrame(loop);
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { tick(false); }); } }
  w.addEventListener('scroll', onScroll, { passive: true });
  var rz;
  w.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { measure(); tick(true); }, 120); });
  mqDesk.addEventListener && mqDesk.addEventListener('change', function () { if (!mqDesk.matches && devices) ['--ty', '--rx', '--ry', '--sc'].forEach(function (v) { devices.style.removeProperty(v); }); measure(); tick(true); });
  w.addEventListener('load', function () { measure(); tick(true); });

  if (mqPin.addEventListener) mqPin.addEventListener('change', function () { applyMode(); measure(); tick(true); });
  applyMode();
  measure();
  tick(true);
  // mark ready only after everything initialised; otherwise the <head> gate drops .js after 3 s and all content shows statically
  root.classList.add('motion-ready');
})();
