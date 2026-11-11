/* Ruta IA: barras del plan, trazo de la línea y punto de partida según la sesión. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal(list, cls) {
    if (reduce || !('IntersectionObserver' in window)) {
      list.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.35 });
    list.forEach(function (el) { io.observe(el); });
  }
  reveal([].slice.call(document.querySelectorAll('.og-plan, .ruta-car, .fase__draw, .entrada__flow, .fases')), 'is-in');

  var raw = null;
  try { raw = sessionStorage.getItem('onix-autodiagnostico'); } catch (e) {}
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch (e) { return; }
  if (!data || !data.level) return;
  var fase = '01';
  if (data.level === 'Definido') fase = '02';
  else if (data.level === 'Gestionado') fase = '03';
  if (fase === '03' && data.route === 'Completa') fase = '02';
  document.querySelectorAll('[data-fase="' + fase + '"]').forEach(function (el) {
    el.classList.add('is-start');
    if (!el.querySelector('.ruta__tag')) {
      var tag = document.createElement('p');
      tag.className = 'ruta__tag';
      tag.textContent = 'Tu punto de partida';
      el.insertBefore(tag, el.firstChild);
    }
  });
  var note = document.querySelector('[data-ruta-personal]');
  if (note && data.date) {
    var d = new Date(data.date);
    var fecha = isNaN(d.getTime()) ? data.date : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    note.hidden = false;
    note.innerHTML = 'Según tu autodiagnóstico del ' + fecha + '. <a href="/autodiagnostico">Repetirlo</a>';
  }
})();
