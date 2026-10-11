/* Demostración · Documentos Vivos.
   El scroll conduce la narración: cada paso enciende su escena en el panel.
   Datos ficticios. No se envía ni se guarda nada. */
(function () {
  'use strict';

  var quieto  = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pasos   = [].slice.call(document.querySelectorAll('.dv-step'));
  var escenas = [].slice.call(document.querySelectorAll('.dv-scene'));
  var titulo  = document.getElementById('dv-titulo');
  var panel   = document.querySelector('.dv-panel');
  var avance  = document.getElementById('dv-avance');
  var actual  = null;

  var TITULOS = {
    '1': 'Negocio Ejemplo · Repositorio',
    '2': 'Negocio Ejemplo · Manual de operación',
    '3': 'Negocio Ejemplo · Permisos de consulta',
    '4': 'Negocio Ejemplo · Asistente virtual'
  };

  function escalonar(escena) {
    [].slice.call(escena.children).forEach(function (hijo, i) { hijo.style.setProperty('--i', i); });
  }

  function encender(n) {
    if (n === actual) return;
    actual = n;
    escenas.forEach(function (s) {
      var entra = s.id === 'dv-e' + n;
      s.classList.toggle('sale', !entra && s.classList.contains('on'));
      s.classList.toggle('on', entra);
      if (entra) escalonar(s);
    });
    pasos.forEach(function (p) { p.classList.toggle('on', p.dataset.escena === n); });
    if (titulo && TITULOS[n]) titulo.textContent = TITULOS[n];
    if (avance) {
      [].slice.call(avance.children).forEach(function (m, i) { m.classList.toggle('on', String(i + 1) === n); });
    }
    if (panel && !quieto) {
      panel.classList.add('cambia');
      window.clearTimeout(encender._t);
      encender._t = window.setTimeout(function () { panel.classList.remove('cambia'); }, 420);
    }
  }

  var escenario = document.querySelector('.dv-stage');
  if (escenario && 'IntersectionObserver' in window && pasos.length) {
    escenario.classList.add('js-dv');
    var io = new IntersectionObserver(function (entradas) {
      var mejor = null;
      entradas.forEach(function (e) {
        if (e.isIntersecting && (!mejor || e.intersectionRatio > mejor.intersectionRatio)) mejor = e;
      });
      if (mejor) encender(mejor.target.dataset.escena);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .2, .6, 1] });
    pasos.forEach(function (p) { io.observe(p); });
    encender('1');
  }

  /* ── Asistente virtual ──────────────────────────────────────────────
     Responde solo con lo que está en el repositorio y cita de dónde salió.
     Si no lo encuentra, lo dice; no lo supone. */
  var RESPUESTAS = [
    { re: /garant[íi]a|devoluci[óo]n|cambio/i,
      texto: 'La garantía del producto cubre defectos de fabricación y no cubre daños por mal uso.',
      cita: 'Manual de operación, versión 4, apartado 7.2' },
    { re: /vacacion|permiso|d[íi]as libres|ausencia/i,
      texto: 'El trámite se levanta con tu responsable directo y queda registrado antes de tomarse.',
      cita: 'Reglamento interno, versión 2, apartado 3.1' },
    { re: /proveedor|contrato|plazo de pago|pago/i,
      texto: 'Los contratos con proveedores se renuevan de forma anual y requieren la firma de dirección.',
      cita: 'Contrato marco de ejemplo, cláusula cuarta' },
    { re: /entrega|env[íi]o|reparto/i,
      texto: 'El procedimiento de entrega pide confirmar los datos con quien recibe antes de cerrar la orden.',
      cita: 'Procedimiento de entregas, versión 3, paso 5' }
  ];

  var chat  = document.getElementById('dv-chat');
  var form  = document.getElementById('dv-form');
  var campo = document.getElementById('dv-q');

  function burbuja(clase, html) {
    var p = document.createElement('p');
    p.className = 'dv-msg ' + clase;
    p.innerHTML = html;
    chat.appendChild(p);
    p.scrollIntoView({ block: 'nearest', behavior: quieto ? 'auto' : 'smooth' });
    return p;
  }

  function responder(texto) {
    for (var i = 0; i < RESPUESTAS.length; i++) {
      var r = RESPUESTAS[i];
      if (r.re.test(texto)) {
        burbuja('dv-msg--in', r.texto + '<span class="dv-cita">' + r.cita + '</span>');
        return;
      }
    }
    burbuja('dv-msg--in sin',
      'No encuentro eso en los documentos que tengo cargados, así que no lo voy a suponer.' +
      '<small>Puedes subir el documento que lo explique y vuelvo a buscar.</small>');
  }

  function preguntar(texto) {
    if (!chat || !texto.trim()) return;
    burbuja('dv-msg--out', texto.replace(/[<>]/g, ''));
    if (quieto) { responder(texto); return; }
    var esperando = burbuja('dv-msg--in', '<span class="dv-esc" aria-label="escribiendo"><i></i><i></i><i></i></span>');
    window.setTimeout(function () { esperando.remove(); responder(texto); }, 620);
  }

  [].slice.call(document.querySelectorAll('.dv-quick button')).forEach(function (b) {
    b.addEventListener('click', function () { preguntar(b.textContent.trim()); });
  });
  if (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); preguntar(campo.value); campo.value = ''; });
  }
})();
