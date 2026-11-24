import { QUESTIONS, compute, reportOf, preset } from './autoevaluacion-logica.js';

const WA_GEN = 'https://wa.me/522227097945?text=' + encodeURIComponent('Hola, quiero información sobre el autodiagnóstico de IA de ÓNIX. Aviso de privacidad: https://www.onix-ia.com/aviso-de-privacidad');

function boot() {
  const intro = document.getElementById('ae-intro');
  const qsec = document.getElementById('ae-q');
  const rsec = document.getElementById('ae-res');
  if (!intro || !qsec || !rsec) return;
  const ans = new Array(19).fill(null);
  ans[12] = '';
  let idx = 0;
  let example = false;
  let incl = false;
  const done = {};
  let stg = 0;
  let mx = null;

  function show(which) {
    intro.hidden = which !== 'intro';
    qsec.hidden = which !== 'q';
    rsec.hidden = which !== 'res';
    window.scrollTo(0, 0);
  }

  function letter(i) { return String.fromCharCode(65 + i); }

  function paintQ() {
    const q = QUESTIONS[idx];
    const part = idx < 12 ? 'Parte 1 de 2' : 'Parte 2 de 2 · Tu caso de uso principal';
    const val = ans[idx];
    let opts = '';
    if (!q.text) {
      opts = '<div class="opts" role="radiogroup" aria-labelledby="qtitle">' + q.opts.map(function (o, i) {
        const on = val === (idx === 18 ? i : i + 1);
        return '<button class="opt" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-i="' + i + '"><span class="k" aria-hidden="true">' + letter(i) + '</span><span>' + o + '</span></button>';
      }).join('') + '</div>';
    } else {
      opts = '<label class="fld" for="q13" style="margin-top:24px">Tu caso de uso (opcional)<input id="q13" class="inp" type="text" value="' + escapeAttr(ans[12] || '') + '" aria-describedby="q13h"></label><p id="q13h" class="small soft" style="margin-top:8px">Por ejemplo: asistente de WhatsApp para cotizaciones. Es opcional y no sale de tu navegador.</p>';
    }
    qsec.innerHTML = '<div class="wrap"><div class="qcard" role="group" aria-labelledby="qtitle"><div class="q-top"><span>' + part + '</span><span class="num">' + (idx + 1) + ' de 19</span></div><div class="track" aria-hidden="true"><i style="width:' + Math.round((idx / 19) * 100) + '%"></i></div>' + (q.dim ? '<p class="small" style="margin-top:22px;color:#6D28D9;font-weight:600">' + q.dim + '</p>' : '') + '<h2 id="qtitle" class="h3" style="margin-top:10px">' + q.t + '</h2>' + opts + '<p id="qerr" class="err" hidden>Elige una opción para continuar.</p><div class="navq"><button class="btn-s" type="button" data-back ' + (idx === 0 ? 'disabled' : '') + '>Atrás</button><button class="btn" type="button" data-next>' + (idx === 18 ? 'Ver resultado' : 'Siguiente') + '</button></div></div></div>';
    qsec.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () {
        const i = +b.getAttribute('data-i');
        ans[idx] = idx === 18 ? i : i + 1;
        paintQ();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setTimeout(function () { if (idx < 18) { idx += 1; paintQ(); } }, 260);
        }
      });
    });
    const input = qsec.querySelector('#q13');
    if (input) input.addEventListener('input', function () { ans[12] = input.value; });
    qsec.querySelector('[data-back]').addEventListener('click', function () { if (idx > 0) { idx -= 1; paintQ(); } });
    qsec.querySelector('[data-next]').addEventListener('click', function () {
      const qq = QUESTIONS[idx];
      if (!qq.text && (ans[idx] === null || ans[idx] === undefined)) {
        const err = qsec.querySelector('#qerr');
        if (err) err.hidden = false;
        return;
      }
      if (idx === 18) { example = false; paintRes(); show('res'); return; }
      idx += 1;
      paintQ();
    });
  }

  function paintRes() {
    const R = compute(ans);
    if (!R) {
      rsec.innerHTML = '<div class="wrap"><p class="fmsg"><b>Faltan respuestas para calcular la orientación.</b></p><button class="btn" type="button" data-backq style="margin-top:16px">Volver a las preguntas</button></div>';
      rsec.querySelector('[data-backq]').addEventListener('click', function () { show('q'); paintQ(); });
      return;
    }
    const rep = reportOf(R);
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const kicker = example ? 'Reporte de ejemplo · preparación para IA' : 'Tu reporte orientativo · preparación para IA';
    const ex = example ? '<span><b>Resultado de ejemplo con respuestas de prueba.</b></span>' : '';
    const bullets = rep.bullets.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('');
    const kpis = [
      ['Índice global', R.index + ' de 100'],
      ['Nivel', R.level],
      ['Tipo de caso', R.tipo],
      ['Riesgo estimado', R.risk],
      [R.noElegida ? 'Ruta de referencia' : 'Ruta', R.noElegida ? 'Ruta de referencia' : R.ruta],
      ['Dimensión más baja', R.allTie ? 'Empate' : R.D[R.order[0].k]]
    ].map(function (k) { return '<div class="kpi"><span>' + k[0] + '</span><b>' + escapeHtml(String(k[1])) + '</b></div>'; }).join('');
    const dims = R.D.map(function (n, k) {
      return '<div class="brow"><span>' + n + '</span><span class="btr"><i style="width:' + Math.max(2, R.sc[k]) + '%"></i></span><span class="v">' + R.sc[k] + '</span></div>';
    }).join('');
    const layers = R.layers.map(function (l) {
      return '<div class="lay"><div class="lay-h"><b>' + l.n + '</b><span>' + l.s + ' de 100</span></div></div>';
    }).join('');
    const tipos = ['Cotidiano', 'En transición', 'Transformador'];
    const riesgos = ['Bajo', 'Medio', 'Alto'];
    let cells = '';
    for (let ti = 0; ti < 3; ti++) {
      cells += '<div class="mxr">' + tipos[ti] + '</div>';
      for (let ri = 0; ri < 3; ri++) {
        const ruta = R.M[ti][ri];
        const sel = mx ? (mx[0] === ti && mx[1] === ri) : (ti === R.tipoIdx && ri === R.riskIdx);
        cells += '<button type="button" class="mc rt' + ri + (sel && !mx ? ' sel' : '') + '" data-mx="' + ti + ',' + ri + '">' + ruta + '</button>';
      }
    }
    const pri = rep.pri.map(function (p) {
      const imp = p.hasImp ? '<div style="margin-top:10px">' + p.imp.map(function (m) { return '<div class="imp"><b>' + m[0] + '</b><span>' + escapeHtml(m[1]) + '</span></div>'; }).join('') + '</div>' : '';
      const steps = '<ol>' + p.steps.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ol>';
      const def = p.dt ? '<p class="small" style="margin-top:10px"><b>' + escapeHtml(p.dt) + '</b> ' + escapeHtml(p.dd) + '</p>' : '';
      return '<div class="pri-b"><p class="small soft">' + escapeHtml(p.dim) + '</p><h3 class="h4" style="margin-top:4px">' + escapeHtml(p.h) + '</h3><p class="mut" style="margin-top:8px;font-size:15px">' + escapeHtml(p.p) + '</p>' + def + imp + '<p class="small" style="margin-top:14px;font-weight:600">Cómo empezar</p>' + steps + '</div>';
    }).join('');
    const totalItems = rep.plan.reduce(function (n, g) { return n + g.items.length; }, 0);
    const checked = Object.keys(done).filter(function (k) { return done[k]; }).length;
    const g = rep.plan[stg];
    const gChecked = g.items.filter(function (_, i) { return done[stg + ':' + i]; }).length;
    const checks = g.items.map(function (t, i) {
      const id = 'ck-' + stg + '-' + i;
      const on = !!done[stg + ':' + i];
      return '<label class="ck" for="' + id + '"><input id="' + id + '" type="checkbox" data-ck="' + stg + ':' + i + '"' + (on ? ' checked' : '') + '><span>' + escapeHtml(t) + '</span></label>';
    }).join('');
    const tabs = rep.plan.map(function (pg, i) {
      const c = pg.items.filter(function (_, j) { return done[i + ':' + j]; }).length;
      return '<li role="presentation"><button class="stb" type="button" role="tab" data-stg="' + i + '" aria-selected="' + (i === stg ? 'true' : 'false') + '" tabindex="' + (i === stg ? '0' : '-1') + '"><b>' + escapeHtml(pg.t) + '</b><small>' + escapeHtml(pg.s) + ' · <span class="num">' + c + ' de ' + pg.items.length + '</span></small></button></li>';
    }).join('');
    const mxNote = mx ? '<p class="small" style="margin-top:12px">Si tu caso fuera ' + tipos[mx[0]].toLowerCase() + ' con riesgo ' + riesgos[mx[1]].toLowerCase() + ', la ruta sería ' + R.M[mx[0]][mx[1]] + '. <button type="button" class="tbtn" data-mycase>Ver mi caso</button></p>' : '';
    const canIncl = !example && rep.msg.indexOf('NaN') < 0;
    const href = (incl && canIncl) ? ('https://wa.me/522227097945?text=' + encodeURIComponent(rep.msg)) : WA_GEN;
    rsec.innerHTML = '<div class="wrap"><p class="kicker">' + kicker + '</p><h2 class="h2" style="margin-top:12px">Según tus respuestas, tu nivel orientativo de preparación para IA es ' + escapeHtml(R.level) + '</h2><div class="r-meta"><span>Fecha: <b>' + escapeHtml(fecha) + '</b></span><span>Versión: <b>Gratuita</b></span><span>Cálculo: <b>en tu navegador</b></span>' + ex + '</div><div class="r-sum"><div><p class="r-k">Resumen ejecutivo</p><p class="r-big">' + escapeHtml(rep.summary) + '</p><ul class="r-bul">' + bullets + '</ul></div><div><p class="r-k">Indicadores</p><div class="kpis">' + kpis + '</div></div></div><div class="r-full"><p class="r-k">Índice global</p><div class="gauge"><div class="mk" style="left:' + R.index + '%"><b>' + R.index + '</b><i></i></div><div class="bands">' + [0, 1, 2, 3].map(function (n) { return '<span class="' + (n === R.levelIdx ? 'on' : '') + '"></span>'; }).join('') + '</div><div class="bnames"><span>Inicial<small>0 a 24</small></span><span>En exploración<small>25 a 49</small></span><span>Definido<small>50 a 74</small></span><span>Gestionado<small>75 a 100</small></span></div></div>' + (R.capped ? '<p class="capflag">Tu nivel global se limitó a ' + escapeHtml(R.level) + ' por tu dimensión más baja. El índice no cambia.</p>' : '') + '</div><div class="r-row"><div><p class="r-k">Perfil por dimensión</p><div style="margin-top:12px">' + dims + '</div></div><div><p class="r-k">Madurez por capa</p>' + layers + '</div></div><div class="r-full"><p class="r-k">Ruta de gobierno</p><p class="small soft" style="margin-top:8px">' + (R.noElegida ? 'Ruta de referencia, no elegida' : 'Ruta de gobierno como punto de partida') + ': ' + escapeHtml(R.ruta) + '. ' + escapeHtml(rep.RD[R.ruta]) + '</p><div class="mxg" style="margin-top:16px"><div></div><div class="mxh">Bajo</div><div class="mxh">Medio</div><div class="mxh">Alto</div>' + cells + '</div>' + mxNote + (R.highs >= 2 ? '<p class="escl">Dos o más factores en riesgo alto: la ruta queda solo como referencia y el caso necesita revisión antes de elegirla.</p>' : '') + '<p class="note2">Tipo según cambio en el proceso, autonomía y presencia. Riesgo según el factor más alto: un promedio nunca diluye una señal alta.</p></div>' + (rep.pri.length ? '<div class="r-full" style="margin-top:64px"><p class="r-k">Recomendaciones</p><h2 class="h3" style="margin-top:8px">Tus tres prioridades</h2><div class="pri3" style="margin-top:20px">' + pri + '</div></div>' : '') + '<div class="r-full" style="margin-top:64px"><p class="r-k">Plan por etapas</p><h2 class="h3" style="margin-top:8px">Lo que sigue, en orden</h2><div class="tot" style="margin-top:16px"><span class="num">' + checked + ' de ' + totalItems + ' acciones listas</span></div><div class="plan"><ul class="stl" role="tablist" aria-label="Etapas del plan" aria-orientation="vertical">' + tabs + '</ul><div class="stp" role="tabpanel"><p class="h4">' + escapeHtml(g.t) + '</p><p class="small soft">' + escapeHtml(g.s) + ' · <span class="num">' + gChecked + ' de ' + g.items.length + '</span></p><div style="margin-top:12px;border-top:1px solid #E4E0D5">' + checks + '</div><div class="stn"><button class="tbtn" type="button" data-sp ' + (stg === 0 ? 'disabled' : '') + '>Etapa anterior</button><button class="tbtn" type="button" data-sn ' + (stg === 2 ? 'disabled' : '') + '>Etapa siguiente</button></div><p class="small soft" style="margin-top:14px">Lo que marques no se guarda: al recargar la página se pierde.</p></div></div></div><div class="cta2" style="margin-top:72px"><div><p class="kicker" style="color:#A5A2A9">Siguiente paso</p><h2 class="h3" style="color:#FFFDF7">Platiquemos tu resultado.</h2><p style="margin-top:12px;color:#A5A2A9">Servicio relacionado: ' + (rep.svcHref ? '<a class="lnk" style="display:inline;color:#FFFDF7" href="' + rep.svcHref + '">' + escapeHtml(rep.svc) + '</a>' : escapeHtml(rep.svc)) + '. Tu primera consultoría corre por nuestra cuenta.</p><div class="hero-act" style="margin-top:22px"><a class="btn btn--accent" href="' + href + '" target="_blank" rel="noopener">Escríbenos por WhatsApp<span class="vh"> (abre WhatsApp)</span></a><button class="btn-s" type="button" data-pdf style="color:#FFFDF7;border-color:#A5A2A9">Guardar el reporte en PDF</button></div><p class="wa-note" style="margin-top:16px">Al escribirnos por WhatsApp, ÓNIX (Rodolfo Mora) usará tu número y tu mensaje para responderte y darte seguimiento. WhatsApp (Meta) trata los datos de la conversación bajo sus propias condiciones. <a href="/aviso-de-privacidad">Aviso de privacidad de ÓNIX</a></p></div><div><label class="chk"><input type="checkbox" data-incl ' + (incl ? 'checked' : '') + (canIncl ? '' : ' disabled') + '><span>Incluir el resumen orientativo en el mensaje de WhatsApp.</span></label>' + ((incl && canIncl) ? '<p class="small" style="margin-top:10px">Mensaje que se abrirá en WhatsApp.</p><p class="msgbox" style="margin-top:8px;color:#26262C">' + escapeHtml(rep.msg) + '</p>' : '') + '<button class="tbtn" type="button" data-restart style="margin-top:16px;color:#FFFDF7">Volver a empezar</button></div></div><div class="r-full" style="margin-top:72px"><p class="r-k">Profundiza</p><h2 class="h3" style="margin-top:8px">Cuando necesites más que una foto rápida</h2><div class="tiers" style="margin-top:28px"><div class="tier"><p class="tk">Foto rápida</p><h3 class="h4">Autodiagnóstico</h3><ul><li>Gratis, sin registro</li><li>19 preguntas y tu caso principal</li><li>Este reporte</li></ul></div><div class="tier feat"><p class="tk">Decidir con evidencia</p><h3 class="h4">Evaluación completa</h3><ul><li>Responden varias personas de tu equipo</li><li>Todos tus casos de uso, cada uno con su riesgo</li><li>Respuestas respaldadas con evidencia</li><li>Revisión de un consultor de ÓNIX</li></ul></div><div class="tier"><p class="tk">Ponerlo en marcha</p><h3 class="h4">Acompañamiento</h3><ul><li>Ruta IA a tu medida</li><li>Seguimiento con Ónix Govern</li><li>Plan por etapas con responsables</li></ul></div></div><p class="small soft" style="margin-top:20px">Los servicios de pago se cotizan según alcance y se acuerdan por escrito antes de comenzar.</p></div><p class="small soft" style="margin-top:48px;padding-top:18px;border-top:1px solid #E4E0D5">Resultado orientativo basado en tus respuestas; no sustituye una auditoría ni una evaluación técnica. Diseñamos y revisamos nuestras soluciones con base en buenas prácticas de referencias como ISO/IEC 42001, ISO/IEC 27001 y las guías de OWASP. ÓNIX no es organismo certificador ni está certificado, y nuestro trabajo no constituye una certificación ni garantiza el cumplimiento de esas normas.</p></div>';
    rsec.querySelectorAll('[data-mx]').forEach(function (b) {
      b.addEventListener('click', function () { mx = b.getAttribute('data-mx').split(',').map(Number); paintRes(); });
    });
    const my = rsec.querySelector('[data-mycase]');
    if (my) my.addEventListener('click', function () { mx = null; paintRes(); });
    rsec.querySelectorAll('[data-stg]').forEach(function (b) {
      b.addEventListener('click', function () { stg = +b.getAttribute('data-stg'); paintRes(); });
      b.addEventListener('keydown', function (e) {
        let n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (stg + 1) % 3;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (stg + 2) % 3;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = 2;
        if (n === null) return;
        e.preventDefault();
        stg = n;
        paintRes();
        const nxt = rsec.querySelector('[data-stg="' + n + '"]');
        if (nxt) nxt.focus();
      });
    });
    const sp = rsec.querySelector('[data-sp]');
    const sn = rsec.querySelector('[data-sn]');
    if (sp) sp.addEventListener('click', function () { if (stg > 0) { stg -= 1; paintRes(); } });
    if (sn) sn.addEventListener('click', function () { if (stg < 2) { stg += 1; paintRes(); } });
    rsec.querySelectorAll('[data-ck]').forEach(function (c) {
      c.addEventListener('change', function () { done[c.getAttribute('data-ck')] = c.checked; paintRes(); });
    });
    const cb = rsec.querySelector('[data-incl]');
    if (cb) cb.addEventListener('change', function () { incl = cb.checked; paintRes(); });
    const pdf = rsec.querySelector('[data-pdf]');
    if (pdf) pdf.addEventListener('click', function () { window.print(); });
    rsec.querySelector('[data-restart]').addEventListener('click', function () {
      for (let i = 0; i < 19; i++) ans[i] = i === 12 ? '' : null;
      idx = 0; example = false; incl = false; stg = 0; mx = null;
      Object.keys(done).forEach(function (k) { delete done[k]; });
      show('intro');
    });
  }

  document.getElementById('ae-start').addEventListener('click', function () { example = false; idx = 0; show('q'); paintQ(); });
  document.getElementById('ae-sample').addEventListener('click', function () {
    const p = preset('resultado dos factores altos');
    for (let i = 0; i < 19; i++) ans[i] = p[i];
    example = true; incl = false; stg = 0; mx = null;
    paintRes();
    show('res');
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
