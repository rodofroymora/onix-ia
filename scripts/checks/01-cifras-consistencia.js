#!/usr/bin/env node
'use strict';
/**
 * Check 1 · Consistencia de cifras, plazos, precios, sectores y WhatsApp.
 * Fuente de verdad: release-rules.json (el responsable de contenido llena los TODO).
 * Regla: si una lista aprobada NO está vacía, todo lo detectado en el HTML que no esté en ella falla.
 * Lista vacía = validación desactivada (solo se imprime el inventario detectado).
 * Centinela: una lista con "__NINGUNA_APROBADA__" (o "__NINGUNO_APROBADO__") ACTIVA la validación sin aprobar
 * nada: cualquier cifra/plazo/precio/sector detectado falla.
 * Sectores: comparación EXACTA (aprobar "clínica" no aprueba "clínicas").
 * Excepción POR RUTA (release-rules.json → excepcionesPorRuta): solo aviso-de-privacidad.html y solo cifras/plazos/fechas
 * (ver lib.js); NO es una aprobación general. Precios, sectores y WhatsApp siguen aplicando.
 * Los formatos visibles aprobados del WhatsApp (whatsapp.formatosVisiblesPermitidos) no cuentan como cifra.
 * El número de WhatsApp SIEMPRE se valida (es dato fijo).
 */
const L = require('./lib');
const reglas = L.leerReglas();
const R = new L.Reporte('Cifras / plazos / precios / sectores / WhatsApp');
L.validarExcepcionesPorRuta(reglas).forEach((e) => R.error('release-rules.json', null, e));

const PRECIO = /(?:US\$|MX\$|\$)\s?\d[\d,.]*(?:\s?(?:MXN|USD|pesos|mil|k)\b)?|\b\d[\d,.]*\s?(?:MXN|USD|pesos)\b/gi;
const NUM_PALABRA = '(?:\\d+(?:[.,]\\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte|treinta)';
const PLAZO = new RegExp('\\b' + NUM_PALABRA + '(?:\\s?(?:a|-|–|y)\\s?' + NUM_PALABRA + ')?\\s+(?:minutos?|horas?|d[ií]as?(?:\\s+h[aá]biles)?|semanas?|quincenas?|meses|mes|a[nñ]os?)\\b|\\b24\\s?\\/\\s?7\\b', 'gi');
const CIFRA = /(?<![\w.])\+?\d[\d,.]*\s?(?:%|×|x\b|veces\b|millones\b|clientes\b|proyectos\b|empresas\b|usuarios\b|casos\b|personas\b|pymes\b)|(?<![\w])\+\s?\d[\d,.]*/gi;
const TELEFONO = /(?<!\d)(?:\+?\s?52\s?)?(?:1\s?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

function unicos(arr) { return [...new Set(arr.map((s) => s.trim()))]; }
function extraer(re, texto) { re.lastIndex = 0; return unicos(texto.match(re) || []); }

const listas = {
  cifras: L.listaAprobada(reglas.cifrasAprobadas),
  plazos: L.listaAprobada(reglas.plazosAprobados),
  precios: L.listaAprobada(reglas.preciosAprobados),
  sectores: L.listaAprobada(reglas.sectoresPermitidos),
};
const aprobado = {
  cifras: listas.cifras.valores.map(L.normalizar),
  plazos: listas.plazos.valores.map(L.normalizar),
  precios: listas.precios.valores.map(L.normalizar),
  sectores: listas.sectores.valores.map(L.normalizarSector),
};
const inventario = { cifras: new Map(), plazos: new Map(), precios: new Map(), sectores: new Map() };
function anotar(tipo, valor, pagina) {
  if (!inventario[tipo].has(valor)) inventario[tipo].set(valor, new Set());
  inventario[tipo].get(valor).add(pagina);
}

const waNum = String(reglas.whatsapp && reglas.whatsapp.numero || '').replace(/\D/g, '');
const waMe = (reglas.whatsapp && reglas.whatsapp.waMe) || '';
const visiblesOk = ((reglas.whatsapp && reglas.whatsapp.formatosVisiblesPermitidos) || []).map((s) => s.replace(/\D/g, ''));
const vocab = reglas.sectoresVocabulario || [];
const vocabRe = vocab.map((w) => ({ w, re: new RegExp('(?<![\\p{L}\\p{N}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'iu') }));

for (const f of L.listarHtml()) {
  const nombre = L.rel(f);
  const html = L.leer(f);
  const limpio = L.sinComentariosScriptsEstilos(html);
  const tags = L.etiquetas(limpio);

  // Texto auditable: visible + title + descriptions + alt/aria-label/title attrs
  const texto = L.textoAuditable(html);
  // Sin los formatos visibles aprobados del WhatsApp (p. ej. "+52 222 709 7945") para no detectarlos como cifra
  const textoCifras = L.quitarFormatosWhatsapp(texto, (reglas.whatsapp && reglas.whatsapp.formatosVisiblesPermitidos) || []);

  const exentas = L.categoriasExentas(reglas, nombre);
  if (exentas.size) R.nota(`${nombre}: excepción por ruta activa para: ${[...exentas].join(', ')}.`);
  // --- Precios / plazos / cifras
  for (const [tipo, re] of [['precios', PRECIO], ['plazos', PLAZO], ['cifras', CIFRA]]) {
    for (const v of extraer(re, textoCifras)) {
      anotar(tipo, v, nombre);
      if (listas[tipo].activa && !exentas.has(tipo) && !aprobado[tipo].some((a) => L.normalizar(v) === a || L.normalizar(v).includes(a) && a.length >= L.normalizar(v).length)) {
        const campo = { precios: 'preciosAprobados', plazos: 'plazosAprobados', cifras: 'cifrasAprobadas' }[tipo];
        R.error(nombre, L.lineaDeFragmento(html, v), `${{ precios: 'Precio no aprobado', plazos: 'Plazo no aprobado', cifras: 'Cifra no aprobada' }[tipo]}: "${v}". Si es correcto, el responsable de contenido debe agregarlo a "${campo}" en release-rules.json; si no, corregir el texto.`);
      }
    }
  }

  // --- Sectores
  for (const { w, re } of vocabRe) {
    if (re.test(texto)) {
      anotar('sectores', w, nombre);
      if (listas.sectores.activa && !aprobado.sectores.includes(L.normalizarSector(w))) {
        R.error(nombre, L.lineaDeFragmento(html, w), `Sector no permitido mencionado: "${w}". Agregarlo a "sectoresPermitidos" (requiere aprobación) o quitar la mención.`);
      }
    }
  }

  // --- WhatsApp: siempre
  for (const t of tags) {
    for (const attr of ['href', 'action', 'src']) {
      const v = t.attrs[attr];
      if (!v) continue;
      let m;
      if ((m = v.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?[^#]*phone=|whatsapp:\/\/send\?[^#]*phone=)(\+?\d+)/i))) {
        if (m[1].replace(/\D/g, '') !== ('52' + waNum) && m[1].replace(/\D/g, '') !== waNum) {
          R.error(nombre, t.line, `Enlace de WhatsApp con número distinto al aprobado: "${v}". Debe ser ${waMe}.`);
        } else if (waMe && !v.includes(waMe)) {
          R.aviso(nombre, t.line, `Enlace de WhatsApp con formato distinto al aprobado (${waMe}): "${v}".`);
        }
      } else if (/^tel:/i.test(v)) {
        const d = v.replace(/\D/g, '');
        if (!d.endsWith(waNum)) R.error(nombre, t.line, `Enlace tel: con número que no es el aprobado (${waNum}): "${v}".`);
      }
    }
  }
  for (const m of (texto.match(TELEFONO) || [])) {
    const d = m.replace(/\D/g, '');
    const ok = d.endsWith(waNum) && (d === waNum || d === '52' + waNum || d === '521' + waNum);
    if (!ok && !visiblesOk.includes(d)) R.error(nombre, null, `Número telefónico visible distinto al aprobado (${waNum}): "${m.trim()}".`);
  }
}

// --- Resumen / inventario (informativo)
const resumen = (tipo, campo) => {
  const aprob = (reglas[campo] || []).length;
  if (aprob && L.listaAprobada(reglas[campo]).soloCentinela) R.nota(`${campo}: solo centinela → validación ACTIVA, nada aprobado.`);
  const items = [...inventario[tipo].entries()].map(([v, p]) => `"${v}" [${[...p].join(', ')}]`);
  R.nota(`${tipo.toUpperCase()} detectados: ${items.length ? items.join('; ') : '(ninguno)'}`);
  if (!aprob) R.aviso(null, null, `"${campo}" está vacía en release-rules.json (pendiente de aprobación): no se valida ${tipo}.`);
};
resumen('cifras', 'cifrasAprobadas');
resumen('plazos', 'plazosAprobados');
resumen('precios', 'preciosAprobados');
resumen('sectores', 'sectoresPermitidos');
R.terminar();
