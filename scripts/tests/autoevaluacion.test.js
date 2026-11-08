#!/usr/bin/env node
'use strict';
/**
 * Lógica, copy y regresiones de /autoevaluacion.
 * Los 6 checks de release leen HTML (textoAuditable) y no importan autoevaluacion.js:
 * esta prueba cubre el módulo de lógica y las regresiones de Arquitectura / Marketing.
 * Uso: node scripts/tests/autoevaluacion.test.js   (Node 20, sin dependencias, sin navegador)
 */
const fs = require('fs');
const path = require('path');
const L = require('../checks/lib');
const { compilar, revisarTexto } = require('../checks/05-frases-prohibidas');

const raiz = path.resolve(__dirname, '..', '..');
const AE = require(path.join(raiz, 'autoevaluacion-logica.js'));
const reglas = JSON.parse(fs.readFileSync(path.join(raiz, 'release-rules.json'), 'utf8'));
const comp = compilar(reglas);
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : `\n    esperado ${JSON.stringify(esperado)}\n    obtenido ${JSON.stringify(obtenido)}`}`);
};
const html = fs.readFileSync(path.join(raiz, 'autoevaluacion.html'), 'utf8');
const jsDom = fs.readFileSync(path.join(raiz, 'autoevaluacion.js'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'autoevaluacion.css'), 'utf8');
const confianza = fs.readFileSync(path.join(raiz, 'confianza-y-gobierno.html'), 'utf8');

function caso(extra) {
  return Object.assign({
    m: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    name: '', proc: 1, aut: 1, pres: 1, datos: 1, afect: 1, area: 4, org: '', sample: false
  }, extra);
}
const factor = (r, n) => r.factors.filter(function (f) { return f.n === n; })[0].v;
const plano = (s) => String(s).replace(/<[^>]+>/g, '');

// ── Cobertura: los checks no ven el JS ──────────────────────────────────
const aud = L.textoAuditable(html);
prueba('check 05 no ve el mensaje de WhatsApp que solo vive en el JS', aud.includes('Resultado orientativo según mis respuestas'), false);
['01-cifras-consistencia.js', '02-cta-unico.js', '03-enlaces-y-assets.js', '04-qa-smoke.js', '05-frases-prohibidas.js', '06-textos-obligatorios.js'].forEach((f) => {
  const src = fs.readFileSync(path.join(raiz, 'scripts/checks', f), 'utf8');
  prueba(`el check ${f} no importa autoevaluacion.js`, src.includes('autoevaluacion.js'), false);
});
const visibles = AE.textosVisibles().join('\n');
const hitsJs = revisarTexto(visibles, comp, '/autoevaluacion');
const bloqueosJs = hitsJs.filter((h) => h.nivel === 'bloqueante').map((h) => h.id + ':' + h.coincidencia);
prueba('cadenas visibles del JS sin frase bloqueante', bloqueosJs, []);
const avisosJs = [...new Set(hitsJs.filter((h) => h.nivel === 'advertencia').map((h) => h.id))].sort();
prueba('avisos del JS solo los ya conocidos (clasifica, jerga)', avisosJs, ['clasifica-generico', 'jerga-tecnica']);

// ── Forma del cuestionario ──────────────────────────────────────────────
prueba('19 preguntas', AE.STEPS.length, 19);
prueba('12 de preparación y 7 del caso', [AE.STEPS.filter((s) => s.p === 'm').length, AE.STEPS.filter((s) => s.p === 'c').length], [12, 7]);
prueba('6 dimensiones', AE.DIMS.length, 6);
prueba('opción de datos sin afirmar ausencia de riesgo', AE.STEPS.find((s) => s.k === 'datos').o[0], 'Pública o interna no confidencial');
prueba('impacto bajo no autoriza que la IA actúe sola', AE.RECS.rie.lv[0][2], 'Uso interno con información pública o interna no confidencial. Define controles y supervisión según el caso; registra las acciones de la IA.');
prueba('ruta rápida orientativa', AE.ROUTE_INFO[0], 'Lista básica de revisión y una persona responsable. Antes de lanzar, confirma qué riesgos y controles aplican a tu caso; esta ruta es orientativa.');
prueba('el enlace de revisión de riesgos conserva la URL', AE.SVC_URL[AE.SERVICIO_RIESGOS], '/servicios/auditoria-de-ia');
prueba('no reintroduce el nombre comercial pendiente', [html, jsDom, fs.readFileSync(path.join(raiz, 'autoevaluacion-logica.js'), 'utf8')].some((t) => t.includes('Auditoría IA Confiable')), false);

// ── Puntaje, tope y riesgo = máximo ─────────────────────────────────────
function dim(par) {
  const a = (par[0] + par[1]) / 2;
  return Math.round((a - 1) / 3 * 100);
}
prueba('bandas 0, 24, 25, 49, 50, 74, 75, 100', [0, 24, 25, 49, 50, 74, 75, 100].map(AE.lvl), [1, 1, 2, 2, 3, 3, 4, 4]);
prueba('lvl rechaza NaN', AE.lvl(NaN), null);
const pares = [[1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4], [4, 4]];
prueba('fórmula de dimensión', pares.map(dim), [0, 17, 33, 50, 67, 83, 100]);
const tope = AE.compute(caso({ m: [1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] }));
prueba('el tope deja el índice y baja el nivel', [tope.gs, tope.gl, tope.capped, AE.LEVELS[tope.gl - 1]], [83, 2, true, 'En exploración']);
const senal = AE.compute(caso({ datos: 1, afect: 3, aut: 1, area: 4 }));
prueba('el riesgo es el factor más alto, no el promedio', senal.risk, 3);

// Matriz 3×3: tipo × riesgo → ruta
const matriz = [];
[[1, 1], [3, 1], [4, 1]].forEach((pp, ti) => {
  [1, 2, 3].forEach((datos) => {
    const r = AE.compute(caso({ proc: pp[0], aut: 1, pres: pp[1], datos: datos, afect: 1, area: 4 }));
    matriz.push([r.tipo, r.risk, r.route]);
  });
});
prueba('matriz de rutas', matriz, [
  [0, 1, 0], [0, 2, 1], [0, 3, 2],
  [1, 1, 1], [1, 2, 1], [1, 3, 2],
  [2, 1, 1], [2, 2, 2], [2, 3, 2]
]);

// ── Regresión: supervisión superficial no queda en ruta más ligera ─────
const superficial = AE.compute(caso({ proc: 3, aut: 2, pres: 1, area: 4 }));
const aprueba = AE.compute(caso({ proc: 3, aut: 3, pres: 1, area: 4 }));
prueba('escenario Arquitectura: superficial es Transformador/Alto/Completa', [AE.TYPES[superficial.tipo], AE.RISKS[superficial.risk - 1], AE.ROUTES[superficial.route], factor(superficial, 'Autonomía')], ['Transformador', 'Alto', 'Completa', 3]);
prueba('escenario Arquitectura: aprobar antes no es más exigente en la ruta', [AE.TYPES[aprueba.tipo], AE.RISKS[aprueba.risk - 1], AE.ROUTES[aprueba.route], factor(aprueba, 'Autonomía')], ['Transformador', 'Medio', 'Completa', 2]);
prueba('la escala de autonomía no pone la revisión superficial por debajo', [AE.autScale(2), AE.autScale(3)], [3, 3]);
prueba('el riesgo de supervisión sí las separa', AE.autRisk(2) > AE.autRisk(3), true);
let coherencia = 0;
const serviciosMasLigeros = [];
for (let proc = 1; proc <= 4; proc++) {
  for (let pres = 1; pres <= 4; pres++) {
    for (let datos = 1; datos <= 3; datos++) {
      for (let afect = 1; afect <= 3; afect++) {
        for (let area = 0; area <= 5; area++) {
          const a = AE.compute(caso({ proc: proc, pres: pres, datos: datos, afect: afect, area: area, aut: 2 }));
          const b = AE.compute(caso({ proc: proc, pres: pres, datos: datos, afect: afect, area: area, aut: 3 }));
          if (a.route < b.route || factor(a, 'Autonomía') <= factor(b, 'Autonomía')) coherencia++;
          const rango = (s) => s === AE.SERVICIO_RIESGOS ? 1 : 0;
          if (rango(AE.nextService(a)) < rango(AE.nextService(b))) serviciosMasLigeros.push([proc, pres, datos, afect, area]);
        }
      }
    }
  }
}
prueba('en 864 combinaciones la revisión superficial no baja de ruta ni de riesgo', coherencia, 0);
prueba('tampoco recomienda un servicio más ligero', serviciosMasLigeros, []);
const soloSup = AE.compute(caso({ proc: 1, aut: 2 }));
const soloApr = AE.compute(caso({ proc: 1, aut: 3 }));
prueba('con el proceso en apoyo, la superficial queda por encima de la aprobación', [AE.ROUTES[soloSup.route], AE.ROUTES[soloApr.route]], ['Completa', 'Estándar']);

// ── Regresión: avance único y respuestas incompletas ───────────────────
function reloj() {
  const timers = [];
  return {
    timers: timers,
    set: (fn) => { const t = { fn: fn, cleared: false, id: timers.length }; timers.push(t); return t; },
    clear: (t) => { t.cleared = true; },
    disparar() { timers.forEach((t) => { if (!t.cleared) { t.cleared = true; t.fn(); } }); }
  };
}
const doble = reloj();
const navDoble = AE.crearAvance(19);
navDoble.programar(doble.set, doble.clear, 200, function () {});
navDoble.programar(doble.set, doble.clear, 200, function () {});
doble.disparar();
prueba('dos clics en la opción avanzan una sola pregunta', [navDoble.indice(), doble.timers[0].cleared], [1, true]);

const mixto = reloj();
const navMixto = AE.crearAvance(19);
navMixto.programar(mixto.set, mixto.clear, 200, function () {});
navMixto.siguiente(mixto.clear);
mixto.disparar();
prueba('clic y Siguiente no saltan la pregunta, aunque el temporizador dispare', navMixto.indice(), 1);

const tarde = reloj();
const navTarde = AE.crearAvance(19);
navTarde.programar(tarde.set, tarde.clear, 200, function () {});
navTarde.siguiente(function () {});
tarde.timers.forEach((t) => t.fn());
prueba('un temporizador tardío no vuelve a avanzar', navTarde.indice(), 1);

const incompleto = caso({ m: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, undefined] });
prueba('respuestas incompletas no son válidas', AE.entradasValidas(incompleto), false);
prueba('compute no devuelve NaN', AE.compute(incompleto), null);
prueba('no hay mensaje de WhatsApp para un resultado inválido', AE.mensajeWhatsapp(null, AE.SERVICIO_RUTA), '');
const baseWa = 'https://wa.me/522227097945?text=Hola';
prueba('href no incorpora NaN', AE.hrefWhatsapp({ base: baseWa, incluir: true, gs: NaN, msg: 'índice NaN de 100' }).includes('NaN'), false);
prueba('href inválido se queda en el genérico', AE.hrefWhatsapp({ base: baseWa, incluir: true, gs: NaN, msg: 'índice NaN' }), baseWa);

// ── Empate, ruta no definitiva, privacidad del mensaje ─────────────────
const ceros = AE.compute(caso());
const textoCeros = plano(AE.htmlResumen('Tu caso de uso principal', ceros));
prueba('empate en cero no inventa fortaleza ni brecha', textoCeros.includes('mayor fortaleza') || textoCeros.includes('principal brecha'), false);
prueba('el empate se dice', textoCeros.includes('empatan'), true);
prueba('el mensaje no ordena prioridades ficticias', AE.mensajeWhatsapp(ceros, AE.nextService(ceros)).includes('no hay una brecha única'), true);
const parcial = AE.compute(caso({ m: [1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4] }));
prueba('empate parcial nombra las brechas, no una sola', plano(AE.htmlResumen('Caso', parcial)).includes('brechas más grandes empatan'), true);

const alto = AE.compute(caso({ datos: 3, afect: 3, aut: 4, proc: 4 }));
const textoAlto = plano(AE.htmlResumen('Caso', alto));
prueba('dos factores altos: la ruta no queda elegida', alto.highs >= 2 && textoAlto.includes('no queda elegida') && !textoAlto.includes('le corresponde'), true);
prueba('WhatsApp tampoco la da por elegida', AE.mensajeWhatsapp(alto, AE.nextService(alto)).includes('no queda elegida'), true);

const conNombre = AE.compute(caso({ name: 'Ada Lovelace RFC XAXX010101000', proc: 4, aut: 4, datos: 3 }));
const msg = AE.mensajeWhatsapp(conNombre, AE.nextService(conNombre));
prueba('el resumen no lleva nombre, organización ni respuestas sueltas', msg.includes('Ada Lovelace') || msg.includes('XAXX') || msg.includes('Empresa Ejemplo'), false);
prueba('el plan sí puede mostrar el nombre en la página', AE.planEtapas(conNombre, { name: 'Ada Lovelace' })[0].acts[0].t.includes('Ada Lovelace'), true);
prueba('el escape cubre HTML', AE.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
const resumenOk = AE.mensajeWhatsapp(ceros, AE.SERVICIO_RUTA);
prueba('sin consentimiento el href no lleva el resumen', AE.hrefWhatsapp({ base: baseWa, waBase: AE.WA_BASE, incluir: false, gs: ceros.gs, msg: resumenOk }), baseWa);
prueba('el ejemplo no se manda aunque la casilla esté marcada', AE.hrefWhatsapp({ base: baseWa, waBase: AE.WA_BASE, incluir: true, sample: true, gs: ceros.gs, msg: resumenOk }), baseWa);
prueba('un resultado anterior no se manda', AE.hrefWhatsapp({ base: baseWa, waBase: AE.WA_BASE, incluir: true, stale: true, gs: ceros.gs, msg: resumenOk }), baseWa);
const hrefSi = AE.hrefWhatsapp({ base: baseWa, waBase: AE.WA_BASE, incluir: true, gs: ceros.gs, msg: resumenOk });
prueba('con consentimiento el href lleva el resumen orientativo', decodeURIComponent(hrefSi).includes('Resultado orientativo según mis respuestas'), true);

// ── Política comercial: no se cambia; sí la justificación ──────────────
prueba('todo al mínimo sigue sugiriendo Acompañamiento', [ceros.gs, AE.RISKS[ceros.risk - 1], AE.ROUTES[ceros.route], AE.tierRecomendada(ceros)], [0, 'Bajo', 'Rápida', 2]);
prueba('la justificación no atribuye esa sugerencia al riesgo', AE.motivoTier(2).includes('riesgo'), false);
prueba('texto de acompañamiento', AE.motivoTier(2), 'Según tus respuestas, puede convenirte acompañamiento para preparar los siguientes pasos; confirmamos el alcance contigo.');
prueba('texto de evaluación completa', AE.motivoTier(1), 'La evaluación completa permite contrastar tus respuestas con evidencia y precisar los siguientes pasos.');
prueba('título orientativo', AE.tituloReporte('Inicial'), 'Según tus respuestas, tu nivel orientativo de preparación para IA es Inicial');
prueba('movimiento reducido no usa scroll suave', [AE.comportamientoScroll(true), AE.comportamientoScroll(false)], ['auto', 'smooth']);
prueba('el radar anuncia las seis puntuaciones', AE.DIMS.every((d) => AE.etiquetaRadar(AE.compute(AE.SAMPLE)).includes(d.n + ':')), true);

// ── Página: copy, foco, contraste, impresión, pie ──────────────────────
const FORMULA = 'ÓNIX no es organismo certificador ni está certificado, y nuestro trabajo no constituye una certificación ni garantiza el cumplimiento de esas normas.';
prueba('la fórmula Legal está literal en la página', html.includes(FORMULA), true);
const bloqueosHtml = revisarTexto(aud, comp, '/autoevaluacion').filter((h) => h.nivel === 'bloqueante').map((h) => h.id);
prueba('la fórmula no dispara un bloqueo de «garantiza»', bloqueosHtml.includes('garantia'), false);
prueba('«No garantizamos» sigue bloqueado fuera de esa oración', revisarTexto('No garantizamos resultados', comp, '/').some((h) => h.id === 'garantia' && h.nivel === 'bloqueante'), true);
prueba('el mensaje genérico no dice que ya contestó', html.includes('hice%20la%20autoevaluaci') || html.includes('hice la autoevaluación'), false);
prueba('hay noscript y casilla de resumen', html.includes('<noscript>') && html.includes('id="waIncluir"'), true);
prueba('el pie de Confianza enlaza la autoevaluación', confianza.includes('href="/autoevaluacion"'), true);
prueba('el JS usa un solo avance y cancela al pulsar Siguiente', jsDom.includes('navQ.programar') && jsDom.includes('navQ.siguiente'), true);
prueba('el JS marca inert al ocultar matriz y flotante', jsDom.includes('el.inert = true') && jsDom.includes('marcarInerte(flotante'), true);
prueba('el JS restaura el href al repetir', jsDom.includes("consentimiento('anterior')"), true);
prueba('el scroll del reporte respeta movimiento reducido', jsDom.includes('scrollIntoView({ behavior: scrollBeh()'), true);
prueba('la etapa inactiva no baja al 50 % de opacidad', /\.stage:not\(\.is-on\)\s*\{[^}]*opacity:\s*\.5/.test(css), false);
prueba('la etapa inactiva queda en opacidad 1', /\.stage:not\(\.is-on\)\s*\{[^}]*opacity:\s*1/.test(css), true);
prueba('imprimir corta transiciones', css.includes('transition: none !important') && css.includes('html.ae-print'), true);
prueba('el flotante oculto no es visibility:visible', css.includes('.ae-quiz-on .wa-float { opacity: 0; pointer-events: none; visibility: hidden; }'), true);

function lin(c) { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(fg, bg) {
  const L1 = lum(fg), L2 = lum(bg);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
function mezcla(fg, bg, alpha) {
  const n = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = n(fg), B = n(bg);
  const c = A.map((v, i) => Math.round(v * alpha + B[i] * (1 - alpha)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const pleno = contraste('#26262C', '#FFFFFF');
const aMedias = contraste(mezcla('#26262C', '#FFFFFF', 0.5), '#FFFFFF');
prueba('tinta plena sobre blanco pasa 4.5:1', pleno >= 4.5, true);
prueba('la misma tinta al 50 % no pasa 4.5:1', aMedias >= 4.5, false);

const precios = /(?:US\$|MX\$|\$)\s?\d|\b\d[\d,.]*\s?(?:MXN|USD|pesos)\b/i;
prueba('sin importes en la página ni en su lógica', [html, jsDom, fs.readFileSync(path.join(raiz, 'autoevaluacion-logica.js'), 'utf8')].some((t) => precios.test(t)), false);

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron.` : '\n✔ Pruebas de autoevaluación en verde.');
process.exit(fallos ? 1 : 0);
