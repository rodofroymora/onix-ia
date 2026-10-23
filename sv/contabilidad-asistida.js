/* ÓNIX · Contabilidad Asistida: "Pruébalo".
   El visitante marca qué documentos del mes ya llegaron y ve cómo avanza el paquete
   para su contador y qué falta. Datos ficticios (Negocio Ejemplo, C.P. Demo).
   No se envía ni se guarda nada. Sin JS, el HTML ya muestra el estado inicial. */
(function () {
  'use strict';
  var d = document;
  var pkg = d.querySelector('[data-pkg]');
  if (!pkg) return;

  var DOCS = {
    facturas: 'Facturas de proveedores, XML y PDF',
    tickets: 'Fotos de tickets por WhatsApp',
    carpeta: 'Archivos de la carpeta compartida',
    estado: 'Estado de cuenta del mes',
    mov12: 'Comprobante del movimiento del día 12',
    mov27: 'Comprobante del movimiento del día 27'
  };
  var NUM = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];
  var togs = [].slice.call(d.querySelectorAll('.tog[data-doc]'));
  var slots = [].slice.call(pkg.querySelectorAll('[data-slot]'));
  var count = pkg.querySelector('[data-pkg-count]');
  var missList = pkg.querySelector('[data-pkg-miss]');
  var none = pkg.querySelector('[data-pkg-none]');
  var verdict = pkg.querySelector('[data-pkg-verdict]');

  function parte(id, estado, tag, msg) {
    var li = pkg.querySelector('[data-part="' + id + '"]');
    if (!li) return;
    li.className = 'is-' + estado;
    var t = li.querySelector('[data-tag]');
    t.className = 'tag tag--' + estado;
    t.textContent = tag;
    li.querySelector('[data-msg]').textContent = msg;
  }

  function pintar() {
    var on = {};
    togs.forEach(function (t) { on[t.getAttribute('data-doc')] = t.getAttribute('aria-pressed') === 'true'; });
    var total = togs.length;
    var listos = togs.filter(function (t) { return on[t.getAttribute('data-doc')]; }).length;

    slots.forEach(function (s) { s.classList.toggle('on', !!on[s.getAttribute('data-slot')]); });
    if (count) count.textContent = listos + ' de ' + total;

    /* Expediente: se arma con lo que haya llegado por cualquier canal */
    var canales = ['facturas', 'tickets', 'carpeta'].filter(function (k) { return on[k]; }).length;
    if (canales === 3) parte('expediente', 'ok', 'En orden', 'Con lo que ya llegó.');
    else if (canales > 0) parte('expediente', 'rev', 'Incompleto', 'Faltan comprobantes de algún canal.');
    else parte('expediente', 'wait', 'Esperando', 'Aún no llega comprobante alguno.');

    /* Cruce: necesita el estado de cuenta; marca los movimientos sin comprobante */
    var sinComp = ['mov12', 'mov27'].filter(function (k) { return !on[k]; });
    if (!on.estado) parte('cruce', 'wait', 'Esperando', 'Se prepara cuando llegue el estado de cuenta.');
    else if (sinComp.length) parte('cruce', 'rev', 'Con pendientes', 'Hay movimientos sin comprobante.');
    else parte('cruce', 'ok', 'Completo', 'Cada movimiento tiene su comprobante al lado.');

    /* Renglones para revisión */
    if (!on.estado) parte('renglones', 'wait', 'Esperando', 'Salen del cruce con el estado de cuenta.');
    else if (sinComp.length === 2) parte('renglones', 'rev', 'Dos renglones', 'Movimientos del día 12 y del día 27 sin comprobante.');
    else if (sinComp.length === 1) parte('renglones', 'rev', 'Un renglón', 'Movimiento del día ' + sinComp[0].slice(3) + ' sin comprobante.');
    else parte('renglones', 'ok', 'Sin pendientes', 'Tu contador revisa el paquete completo.');

    parte('bitacora', 'ok', 'Al día', 'Qué llegó, qué se leyó y qué se detuvo.');

    /* Qué falta */
    var faltan = Object.keys(DOCS).filter(function (k) { return !on[k]; });
    missList.innerHTML = '';
    faltan.forEach(function (k) {
      var li = d.createElement('li');
      li.textContent = DOCS[k];
      missList.appendChild(li);
    });
    missList.hidden = faltan.length === 0;
    if (none) none.hidden = faltan.length !== 0;

    var lleno = faltan.length === 0;
    pkg.classList.toggle('is-full', lleno);
    if (verdict) {
      verdict.textContent = lleno
        ? 'Listo para que el C.P. Demo lo revise.'
        : listos === 0
          ? 'Todavía no hay qué mandar. Marca lo que ya llegó.'
          : 'Faltan ' + (NUM[faltan.length] || faltan.length) + ' documentos. Lo pendiente va marcado para revisión.';
      if (faltan.length === 1) verdict.textContent = 'Falta uno. Lo pendiente va marcado para revisión.';
    }
  }

  togs.forEach(function (t) {
    t.addEventListener('click', function () {
      t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      pintar();
    });
  });
  pintar();
})();
