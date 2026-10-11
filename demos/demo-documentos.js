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
    { re: /contacto|ventas|qui[ée]n ve|representante/i,
      texto: 'El contacto de ventas de Proveedor Ejemplo es Nombre Ejemplo.',
      cita: 'Correo de alta de proveedor, consolidado en la ficha',
      ruta: ['Proveedores', 'Proveedor Ejemplo', 'ficha consolidada'] },
    { re: /documentos|tocan|relacionad|aparece|d[óo]nde sale/i,
      texto: 'Proveedor Ejemplo aparece en el contrato marco, en el correo de alta y en el manual de entregas. Los tres quedaron conectados a la misma entidad aunque vivan en dominios distintos.',
      cita: 'Red de relaciones: dominios Proveedores y Operación',
      ruta: ['Proveedores', 'Proveedor Ejemplo', 'Operación'] },
    { re: /entrega|recib|env[íi]o|reparto/i,
      texto: 'Al entregar hay que confirmar los datos con quien recibe antes de cerrar la orden.',
      cita: 'Manual de entregas, versión 3, paso 5',
      ruta: ['Operación', 'Entrega a domicilio'] },
    { re: /condicion|cl[áa]usula|contrato|acordad/i,
      texto: 'Las condiciones acordadas con ese proveedor son las de la cláusula cuarta del contrato marco.',
      cita: 'Contrato marco, cláusula cuarta',
      ruta: ['Proveedores', 'Contrato marco'] },
    { re: /permiso|vacacion|personal|reglamento/i,
      texto: 'El trámite se levanta con tu responsable directo y queda registrado antes de tomarse.',
      cita: 'Reglamento interno, versión 2, apartado 3.1',
      ruta: ['Personal', 'Reglamento interno'] }
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

  var ruta = document.getElementById('dv-ruta');

  function pintarRuta(pasos) {
    if (!ruta) return;
    ruta.innerHTML = '';
    pasos.forEach(function (p, i) {
      if (i) {
        ruta.insertAdjacentHTML('beforeend',
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
      }
      var b = document.createElement('b');
      b.textContent = p;
      ruta.appendChild(b);
    });
  }

  function responder(texto) {
    for (var i = 0; i < RESPUESTAS.length; i++) {
      var r = RESPUESTAS[i];
      if (r.re.test(texto)) {
        pintarRuta(r.ruta);
        burbuja('dv-msg--in', r.texto + '<span class="dv-cita">' + r.cita + '</span>');
        return;
      }
    }
    pintarRuta(['sin coincidencias en la red']);
    burbuja('dv-msg--in sin',
      'Eso no está en ningún documento cargado, así que no lo voy a suponer.' +
      '<small>Sube el archivo que lo explique y vuelvo a buscar.</small>');
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
