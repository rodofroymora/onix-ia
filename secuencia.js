(function () {
  var root = document.getElementById('seq');
  if (!root) return;
  var steps = [].slice.call(root.querySelectorAll('.sq'));
  var status = document.getElementById('seq-status');
  var play = document.getElementById('seq-play');
  var reset = document.getElementById('seq-reset');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seq = 0;
  var timer = null;
  function paint() {
    steps.forEach(function (li, n) {
      var on = seq === n + 1;
      li.classList.toggle('on', on);
      li.classList.toggle('done', seq > n + 1);
      li.querySelectorAll('.q, .seq-acts').forEach(function (el) { el.hidden = !on; });
    });
    var log = root.querySelector('[data-log]');
    if (log) {
      log.hidden = seq !== 3;
      log.textContent = seq === 3 ? 'Registro local: propuesta revisada y marcada como aprobada en esta página. No salió ningún mensaje.' : '';
    }
    if (status) status.textContent = seq === 0 ? '' : seq === 1 ? 'El agente preparó un borrador. No se envió.' : seq === 2 ? 'Pausa: esperando aprobación de una persona.' : 'Completado. Quedó el registro en esta página.';
    if (play) play.textContent = reduce ? (seq >= 3 ? 'Repetir' : 'Avanzar un paso') : (seq === 0 ? 'Ver la secuencia' : seq === 3 ? 'Repetir' : 'Continuar');
  }
  function go(n) { seq = n; paint(); }
  steps.forEach(function (li) {
    var b = li.querySelector('.sq-b');
    b.addEventListener('click', function () { clearTimeout(timer); go(+li.getAttribute('data-step')); });
  });
  var approve = root.querySelector('[data-approve]');
  var changes = root.querySelector('[data-changes]');
  if (approve) approve.addEventListener('click', function () { go(3); });
  if (changes) changes.addEventListener('click', function () { go(1); });
  if (play) play.addEventListener('click', function () {
    if (seq >= 3) { go(0); return; }
    if (reduce || seq === 0) { go(seq + 1); return; }
    go(Math.min(3, seq + 1));
  });
  if (reset) reset.addEventListener('click', function () { clearTimeout(timer); go(0); });
  paint();
})();
