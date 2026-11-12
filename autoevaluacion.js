import { STEPS, compute, buildWhatsAppHref, reset as resetMsg } from './autoevaluacion-logica.js';

const root = document.getElementById('quiz');
const live = document.getElementById('quiz-live');
const part = document.getElementById('quiz-part');
const bar = document.querySelector('.prog i');
const wa = document.getElementById('waCta');
const box = document.getElementById('waIncluir');
const preview = document.getElementById('waPreview');
if (!root || !wa) throw new Error('quiz');

const answers = { d: Array(12).fill(null), proc: null, aut: null, pres: null, datos: null, afect: null, area: null, nombre: '' };
let i = 0;
let result = null;
let stale = false;

function say(t) { if (live) live.textContent = t || ''; }
function syncWa() {
  const on = box && box.checked && result && !stale;
  const href = buildWhatsAppHref(on ? result : null, !!on);
  wa.href = href;
  if (preview) {
    preview.hidden = !on;
    const sp = document.getElementById('waPreviewText');
    if (sp) sp.textContent = on ? result.wa : '';
  }
}

function paint() {
  const s = STEPS[i];
  const n = i + 1;
  part.textContent = s.p === 'm' ? 'Parte 1 de 2 · preparación' : 'Parte 2 de 2 · Tu caso de uso principal';
  if (bar) bar.style.width = Math.round((i / STEPS.length) * 100) + '%';
  const chosen = currentValue(s);
  let opts = '';
  if (s.type === 'text') {
    opts = '<label class="fld" for="q-name">Descripción, si quieres<input id="q-name" class="inp" type="text" value="' + escapeAttr(answers.nombre) + '"></label><p class="mut">' + s.h + '</p>';
  } else {
    opts = '<div class="opts" role="radiogroup" aria-labelledby="q-title">' + s.o.map((o, k) => {
      const on = chosen === k + (s.k === 'area' ? 0 : 1) || (s.k === 'area' && chosen === k);
      const val = s.k === 'area' ? k : k + 1;
      return '<button type="button" class="quiz-opt" role="radio" aria-checked="' + (valueEquals(s, val) ? 'true' : 'false') + '" data-v="' + val + '">' + escapeText(o) + '</button>';
    }).join('') + '</div>';
  }
  root.innerHTML = '<p class="kicker">Pregunta ' + n + ' de 19</p><h2 id="q-title" class="h2" style="font-size:clamp(1.6rem,3vw,2.2rem)">' + escapeText(s.t) + '</h2>' + (s.h && s.type !== 'text' ? '<p class="mut">' + escapeText(s.h) + '</p>' : '') + opts +
    '<div class="seq-acts"><button type="button" class="btn btn--secondary" id="q-back"' + (i === 0 ? ' disabled' : '') + '>Atrás</button><button type="button" class="btn btn--secondary" id="q-next">Siguiente</button></div><p id="q-miss" class="err" hidden>Elige una respuesta para continuar.</p>';
  root.querySelectorAll('.quiz-opt').forEach((b) => b.addEventListener('click', () => {
    setValue(s, +b.getAttribute('data-v'));
    root.querySelectorAll('.quiz-opt').forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
    const miss = document.getElementById('q-miss');
    if (miss) miss.hidden = true;
  }));
  const name = document.getElementById('q-name');
  if (name) name.addEventListener('input', () => { answers.nombre = name.value; });
  document.getElementById('q-back').addEventListener('click', () => { if (i > 0) { i--; paint(); } });
  document.getElementById('q-next').addEventListener('click', next);
  say('Pregunta ' + n + ' de 19');
}

function valueEquals(s, val) {
  if (s.p === 'm') return answers.d[i] === val;
  return answers[s.k] === val;
}
function currentValue(s) {
  if (s.p === 'm') return answers.d[i];
  if (s.k === 'name') return answers.nombre;
  return answers[s.k];
}
function setValue(s, val) {
  if (s.p === 'm') answers.d[i] = val;
  else answers[s.k] = val;
  stale = false;
}
function next() {
  const s = STEPS[i];
  if (s.type !== 'text' && currentValue(s) == null) {
    const miss = document.getElementById('q-miss');
    if (miss) miss.hidden = false;
    return;
  }
  if (i < STEPS.length - 1) { i++; paint(); return; }
  showResult();
}
function payload() {
  return {
    d: answers.d.slice(),
    proc: answers.proc, aut: answers.aut, pres: answers.pres,
    datos: answers.datos, afect: answers.afect, area: answers.area
  };
}
function showResult() {
  result = compute(payload());
  stale = false;
  if (box) box.disabled = !result;
  if (!result) {
    root.innerHTML = '<h2>No hay un resultado</h2><p>Faltan respuestas o alguna no es válida. No hay índice, nivel ni mensaje.</p><button type="button" class="btn btn--secondary" id="q-again">Volver a empezar</button>';
    document.getElementById('q-again').addEventListener('click', restart);
    syncWa();
    return;
  }
  if (bar) bar.style.width = '100%';
  part.textContent = 'Resultado orientativo';
  try {
    sessionStorage.setItem('onix-autodiagnostico', JSON.stringify({
      level: result.level,
      route: result.route,
      date: new Date().toISOString()
    }));
  } catch (e) {}
  root.innerHTML = '<p class="badge">Prototipo · no publicado</p><h2>Según tus respuestas, tu nivel orientativo de preparación para IA es ' + escapeText(result.level) + '</h2><p>' + escapeText(result.resumen) + '</p><p>' + escapeText(result.rutaFrase) + '</p><p>' + escapeText(result.cierre) + '</p><p>Resultado orientativo. No es asesoría legal.</p><p>Índice de 0 a 100, promedio de las seis dimensiones. El nivel global no puede estar más de un nivel arriba de tu dimensión más baja. Se calcula a partir de tus respuestas; no verifica la implementación o eficacia de controles.</p><p class="mut">Las respuestas se procesaron en este navegador. No se enviaron a Ónix Govern. El nivel queda en esta sesión para marcar tu punto de partida en Ruta IA.</p><p>Servicio para conversar: ' + escapeText(result.servicio) + '.</p><form class="reporte-mail" id="reporte-mail"><label for="reporte-correo">Correo para el reporte</label><input id="reporte-correo" name="correo" type="email" autocomplete="email" placeholder="tu@correo.com" /><button type="submit" class="btn btn--secondary">Recibir el reporte</button><p class="form__status" id="reporte-status" role="status"></p></form><button type="button" class="btn btn--secondary" id="q-again">Volver a empezar</button>';
  var mail = document.getElementById('reporte-mail');
  if (mail) mail.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var input = document.getElementById('reporte-correo');
    var status = document.getElementById('reporte-status');
    var value = (input.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      status.textContent = 'Escribe un correo válido para enviarte el reporte.';
      input.focus();
      return;
    }
    status.textContent = 'Listo. Te enviamos el reporte a ' + value + '.';
  });
  document.getElementById('q-again').addEventListener('click', restart);
  syncWa();
  say('Resultado listo');
}
function restart() {
  answers.d = Array(12).fill(null);
  answers.proc = answers.aut = answers.pres = answers.datos = answers.afect = answers.area = null;
  answers.nombre = '';
  result = null;
  stale = true;
  resetMsg();
  i = 0;
  if (box) { box.checked = false; box.disabled = true; }
  syncWa();
  paint();
}
function escapeText(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return escapeText(s).replace(/"/g, '&quot;'); }

if (box) box.addEventListener('change', syncWa);
paint();
syncWa();
