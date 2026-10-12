/* ÓNIX · Agentes de Operación: «Pruébalo». Cola de aprobación de ejemplo.
   Vanilla, sin dependencias, sin red y sin guardar nada. Datos ficticios.
   Sin JS la cola y la bitácora se ven completas (solo los botones no responden). */
(function () {
  'use strict';
  var d = document;
  var box = d.querySelector('[data-ag-try]');
  if (!box) return;
  var queue = box.querySelector('[data-ag-queue]');
  var log = box.querySelector('[data-ag-log]');
  var status = box.querySelector('[data-ag-status]');
  var pauseBtn = box.querySelector('[data-ag-pause]');
  var pauseLabel = box.querySelector('[data-ag-pause-label]');
  var resetBtn = box.querySelector('[data-ag-reset]');
  var items = [].slice.call(queue.querySelectorAll('[data-ag-task]'));
  var logInicial = log.innerHTML;

  var TAREAS = {
    envio: {
      nombre: 'el envío del borrador a Empresa Demo',
      ok: 'Aprobado. Lo envías desde tu correo; el agente no lo comparte con el cliente.',
      back: 'Devuelto. Regresa a la asistente de borradores para corregirse.',
      sigueOk: ['Seguimiento', 'Anotó el envío y avisó al equipo.'],
      sigueBack: ['Borradores', 'Recibió el borrador de vuelta. No sale nada hacia Empresa Demo.']
    },
    contacto: {
      nombre: 'el primer contacto con Comercial Ejemplo',
      ok: 'Aprobado. Sale desde el WhatsApp de tu equipo.',
      back: 'Devuelto. No sale mensaje; regresa a Seguimiento.',
      sigueOk: ['Seguimiento', 'Dejó lista la respuesta para anotarla cuando llegue.'],
      sigueBack: ['Seguimiento', 'Guardó el mensaje como borrador para ajustarlo.']
    },
    cita: {
      nombre: 'la cita con Taller Ejemplo',
      ok: 'Aprobada. Tu equipo la confirma con el cliente.',
      back: 'Devuelta. No se propone la cita; regresa al agente.',
      sigueOk: ['Seguimiento', 'Avisó al equipo que la visita está propuesta.'],
      sigueBack: ['Seguimiento', 'Marcó la cita para que una persona proponga otra hora.']
    },
    dato: {
      nombre: 'el dato dudoso del escritorio',
      ok: 'Aprobado. Se captura «medida estándar».',
      back: 'Devuelto. Queda pendiente: el Capturista no adivina.',
      sigueOk: ['Capturista', 'Registró la medida del escritorio con tu aprobación.'],
      sigueBack: ['Capturista', 'Dejó el escritorio pendiente para que una persona lo edite.']
    }
  };

  var reloj, pausado, decididas;
  function hora() {
    reloj += 1;
    var h = Math.floor(reloj / 60), m = reloj % 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  }
  function anotar(quien, texto, tu) {
    var li = d.createElement('li');
    li.className = 'is-new';
    var t = d.createElement('time'); t.textContent = hora();
    var w = d.createElement('span'); w.className = 'ag-who' + (tu ? ' ag-who--tu' : ''); w.textContent = quien;
    var x = d.createElement('span'); x.className = 'ag-txt'; x.textContent = texto;
    li.appendChild(t); li.appendChild(w); li.appendChild(x);
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  }
  function pendientes() { return items.length - Object.keys(decididas).length; }
  function pintar() {
    items.forEach(function (it) {
      var id = it.getAttribute('data-ag-task');
      var dec = decididas[id];
      [].slice.call(it.querySelectorAll('[data-ag-act]')).forEach(function (b) {
        b.disabled = !!dec || pausado;
        b.setAttribute('aria-pressed', dec === b.getAttribute('data-ag-act') ? 'true' : 'false');
      });
      it.classList.toggle('is-ok', dec === 'ok');
      it.classList.toggle('is-back', dec === 'back');
      it.querySelector('[data-ag-res]').textContent = dec ? TAREAS[id][dec] : '';
    });
    queue.classList.toggle('is-paused', pausado);
    pauseBtn.setAttribute('aria-pressed', pausado ? 'true' : 'false');
    pauseLabel.textContent = pausado ? 'Reanudar el proceso' : 'Pausar el proceso';
    var n = pendientes();
    if (pausado) status.textContent = 'Proceso en pausa. Lo pendiente quedó en la cola de tu equipo.';
    else if (n === 0) status.textContent = 'Cola vacía. Todo quedó registrado en la bitácora.';
    else status.textContent = 'Proceso en marcha. ' + (n === 1 ? 'Queda una tarea' : 'Quedan ' + n + ' tareas') + ' esperando tu decisión.';
  }
  function decidir(it, act) {
    var id = it.getAttribute('data-ag-task');
    if (pausado || decididas[id]) return;
    decididas[id] = act;
    var t = TAREAS[id];
    anotar('Tú', (act === 'ok' ? 'Aprobaste ' : 'Devolviste ') + t.nombre + '.', true);
    var s = act === 'ok' ? t.sigueOk : t.sigueBack;
    anotar(s[0], s[1]);
    pintar();
  }
  function iniciar() {
    reloj = 10 * 60 + 46; pausado = false; decididas = {};
    log.innerHTML = logInicial;
    pintar();
  }

  items.forEach(function (it) {
    [].slice.call(it.querySelectorAll('[data-ag-act]')).forEach(function (b) {
      b.addEventListener('click', function () { decidir(it, b.getAttribute('data-ag-act')); });
    });
  });
  pauseBtn.addEventListener('click', function () {
    pausado = !pausado;
    if (pausado) anotar('Tú', 'Pausaste el proceso. Los agentes no toman tareas nuevas y lo pendiente pasa a la cola de tu equipo.', true);
    else anotar('Tú', 'Reanudaste el proceso como persona autorizada.', true);
    pintar();
  });
  resetBtn.addEventListener('click', iniciar);
  iniciar();
})();
