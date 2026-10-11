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
      dominios: ['Proveedores'],
      fuentes: ['correo de alta'],
      texto: 'El contacto de ventas de Proveedor Ejemplo es Nombre Ejemplo.',
      cita: 'Correo de alta de proveedor, consolidado en la ficha' },
    { re: /documentos|tocan|relacionad|aparece|d[óo]nde sale/i,
      dominios: ['Proveedores', 'Operación'],
      fuentes: ['contrato.pdf', 'correo de alta', 'manual.docx'],
      texto: 'Proveedor Ejemplo aparece en el contrato marco, en el correo de alta y en el manual de entregas. Los tres quedaron conectados a la misma entidad aunque vivan en dominios distintos.',
      cita: 'Red de relaciones: dominios Proveedores y Operación' },
    { re: /entrega|recib|env[íi]o|reparto|cumplir/i,
      dominios: ['Operación', 'Proveedores'],
      fuentes: ['manual.docx', 'contrato.pdf'],
      texto: 'Al entregar hay que confirmar los datos con quien recibe antes de cerrar la orden, y las condiciones acordadas con ese proveedor son las de la cláusula cuarta.',
      cita: 'Manual de entregas, versión 3, paso 5 · Contrato marco, cláusula cuarta' },
    { re: /condicion|cl[áa]usula|contrato|acordad/i,
      dominios: ['Proveedores'],
      fuentes: ['contrato.pdf'],
      texto: 'Las condiciones acordadas con ese proveedor son las de la cláusula cuarta del contrato marco.',
      cita: 'Contrato marco, cláusula cuarta' },
    { re: /permiso|vacacion|personal|reglamento/i,
      dominios: ['Personal'],
      fuentes: ['reglamento.pdf'],
      texto: 'El trámite se levanta con tu responsable directo y queda registrado antes de tomarse.',
      cita: 'Reglamento interno, versión 2, apartado 3.1' }
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

  var controles = [].slice.call(document.querySelectorAll('.dv-quick button'))
    .concat([].slice.call(document.querySelectorAll('.dv-form button')));
  var trabajando = false;

  function fichas(lista) {
    return '<span class="dv-fichas">' + lista.map(function (f) {
      return '<span class="dv-ficha">' + f + '</span>';
    }).join('') + '</span>';
  }

  /* El rastro de lo que hace el agente, paso a paso y a la vista. */
  function rastro(r) {
    var pasos = [
      { t: 'Leyendo la pregunta' },
      { t: r ? 'Buscando en la red de dominios' : 'Buscando en la red de dominios',
        extra: r ? fichas(r.dominios) : '' },
      { t: r ? 'Abriendo los documentos que conectan' : 'Sin coincidencias en la red',
        extra: r ? fichas(r.fuentes) : '' },
      { t: r ? 'Armando la respuesta y sus citas' : 'Nada que citar' }
    ];
    var caja = document.createElement('div');
    caja.className = 'dv-traza';
    caja.innerHTML = pasos.map(function (p) {
      return '<span class="dv-tpaso"><span class="dv-tpaso__i"><i></i></span>' +
             '<span><b>' + p.t + '</b>' + (p.extra || '') + '</span></span>';
    }).join('');
    chat.appendChild(caja);
    return caja;
  }

  function correrRastro(caja, listo) {
    var filas = [].slice.call(caja.querySelectorAll('.dv-tpaso'));
    if (quieto) {
      filas.forEach(function (f) { f.classList.add('hecho'); });
      listo();
      return;
    }
    var i = 0;
    (function siguiente() {
      if (i) filas[i - 1].classList.replace('activo', 'hecho');
      if (i === filas.length) { listo(); return; }
      filas[i].classList.add('activo');
      filas[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      i++;
      window.setTimeout(siguiente, 480);
    })();
  }

  function responder(r) {
    if (r) {
      burbuja('dv-msg--in', r.texto + '<span class="dv-cita">' + r.cita + '</span>');
    } else {
      burbuja('dv-msg--in sin',
        'Eso no está en ningún documento cargado, así que no lo voy a suponer.' +
        '<small>Sube el archivo que lo explique y vuelvo a buscar.</small>');
    }
    trabajando = false;
    controles.forEach(function (c) { c.disabled = false; });
  }

  function preguntar(texto) {
    if (!chat || !texto.trim() || trabajando) return;
    trabajando = true;
    controles.forEach(function (c) { c.disabled = true; });

    burbuja('dv-msg--out', texto.replace(/[<>]/g, ''));

    var encontrada = null;
    for (var i = 0; i < RESPUESTAS.length; i++) {
      if (RESPUESTAS[i].re.test(texto)) { encontrada = RESPUESTAS[i]; break; }
    }
    correrRastro(rastro(encontrada), function () { responder(encontrada); });
  }

  [].slice.call(document.querySelectorAll('.dv-quick button')).forEach(function (b) {
    b.addEventListener('click', function () { preguntar(b.textContent.trim()); });
  });
  if (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); preguntar(campo.value); campo.value = ''; });
  }
})();
