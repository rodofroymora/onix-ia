/* ÓNIX · menú: mega-menú Servicios (escritorio), acordeón (móvil) y hamburguesa. Accesible con teclado. */
(function () {
  var d = document;
  var trigger = d.getElementById('svc-trigger'), mega = d.getElementById('svc-mega');
  var item = trigger && trigger.closest('.nav__item');
  function setMega(open, focusTrigger) {
    if (!trigger) return;
    mega.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (!open && focusTrigger) trigger.focus();
  }
  if (trigger && mega) {
    trigger.addEventListener('click', function () { setMega(mega.hidden); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mega.hidden) setMega(false, true); });
    d.addEventListener('click', function (e) { if (!mega.hidden && !item.contains(e.target) && !mega.contains(e.target)) setMega(false); });
    item.addEventListener('focusout', function (e) { if (!mega.hidden && e.relatedTarget && !item.contains(e.relatedTarget)) setMega(false); });
  }

  /* Mobile menu */
  var b = d.getElementById('burger'), m = d.getElementById('mmenu');
  function setMenu(open) {
    m.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    d.body.style.overflow = open ? 'hidden' : '';
    // v17 (H-41): while the menu is open, what is behind it is not reachable (inert for AT/pointer; Tab is also trapped below)
    d.querySelectorAll('main, footer').forEach(function (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }
  // v17 (H-41): focus trap — the cycle is the burger plus the visible links/buttons inside the menu
  function trapTab(e) {
    if (e.key !== 'Tab' || m.hidden) return;
    var list = [b].concat([].slice.call(m.querySelectorAll('a[href], button:not([disabled])')).filter(function (el) { return el.offsetParent !== null; }));
    var first = list[0], last = list[list.length - 1], a = d.activeElement;
    if (list.indexOf(a) === -1) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }
  if (b && m) {
    b.addEventListener('click', function () { setMenu(m.hidden); });
    m.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !m.hidden) { setMenu(false); b.focus(); } });
    d.addEventListener('keydown', trapTab);
    window.matchMedia('(min-width: 1121px)').addEventListener('change', function (q) { if (q.matches) setMenu(false); });
  }
  var acc = d.getElementById('mm-acc'), sub = d.getElementById('mm-svc');
  if (acc && sub) acc.addEventListener('click', function () {
    var open = sub.hidden; sub.hidden = !open; acc.setAttribute('aria-expanded', String(open));
  });
})();
