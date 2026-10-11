#!/usr/bin/env node
'use strict';
/**
 * Pruebas del paquete de deploy por entorno (scripts/prepare-deploy.js):
 *   · DEV  (DEPLOY_ENV=dev):  incluye demos/ y cada página de demos/ sale con noindex; robots.txt «Disallow: /»; header X-Robots-Tag;
 *                             .vercelignore del paquete sin «demos» (el del repo no cambia).
 *   · PROD (DEPLOY_ENV=prod o sin definir): no queda ninguna ruta demos/ y .vercelignore sigue excluyéndolo; si no, falla.
 * Uso: node scripts/tests/deploy-demos.test.js   (Node 20, sin dependencias; trabaja sobre copias temporales)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const raiz = path.resolve(__dirname, '..', '..');
const P = require('../prepare-deploy.js');
let fallos = 0;
const prueba = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`${bien ? '✔' : '✖'} ${nombre}${bien ? '' : ` (esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)})`}`);
};

function copiaDelRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-demos-'));
  const archivos = execFileSync('git', ['ls-files'], { cwd: raiz, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of archivos) {
    const src = path.join(raiz, f);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
    fs.copyFileSync(src, path.join(tmp, f));
  }
  return tmp;
}
const rutas = (dir) => P.rutasDemos(dir);
const cli = (cwd, env, extra = []) => spawnSync(process.execPath, [path.join(cwd, 'scripts', 'prepare-deploy.js'), '--force', ...extra], {
  cwd, encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_ACTIONS: '', DEPLOY_ENV: '' }, env),
});
const ignoreRepo = fs.readFileSync(path.join(raiz, '.vercelignore'), 'utf8');
const htmlDemosRepo = P.listarHtml(path.join(raiz, 'demos')).length;

prueba('el repo tiene demos/ con páginas HTML', htmlDemosRepo > 0, true);
prueba('el .vercelignore del repo excluye «demos»', /^demos\s*$/m.test(ignoreRepo), true);

// ── DEV
{
  const d = copiaDelRepo();
  const r = cli(d, { DEPLOY_ENV: 'dev' });
  prueba('DEV: el script termina bien', r.status, 0);
  prueba('DEV: el paquete CONTIENE demos/', rutas(d).length > 0, true);
  const htmls = P.listarHtml(path.join(d, 'demos'));
  prueba('DEV: mismas páginas HTML de demos que el repo', htmls.length, htmlDemosRepo);
  const sinNoindex = htmls.filter((f) => !/<meta\b[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["'][^"']*noindex[^"']*["']/i.test(fs.readFileSync(f, 'utf8')));
  prueba('DEV: toda página de demos/ trae <meta robots noindex>', sinNoindex, []);
  const duplicadas = htmls.filter((f) => (fs.readFileSync(f, 'utf8').match(/<meta\b[^>]*name\s*=\s*["']robots["']/gi) || []).length !== 1);
  prueba('DEV: una sola meta robots por página (idempotente)', duplicadas, []);
  prueba('DEV: robots.txt con «Disallow: /»', /^Disallow:\s*\/\s*$/m.test(fs.readFileSync(path.join(d, 'robots.txt'), 'utf8')), true);
  const v = JSON.parse(fs.readFileSync(path.join(d, 'vercel.json'), 'utf8'));
  const hdrs = (v.headers || []).filter((h) => (h.headers || []).some((kv) => /^x-robots-tag$/i.test(kv.key) && /noindex/i.test(kv.value)));
  prueba('DEV: vercel.json con X-Robots-Tag noindex (una vez)', hdrs.length, 1);
  prueba('DEV: .vercelignore del paquete sin «demos»', /^\/?demos\/?\s*$/m.test(fs.readFileSync(path.join(d, '.vercelignore'), 'utf8')), false);
  prueba('DEV: .vercelignore conserva el resto de exclusiones', /^scripts\s*$/m.test(fs.readFileSync(path.join(d, '.vercelignore'), 'utf8')), true);
  prueba('DEV: el .vercelignore del repo no se modificó', fs.readFileSync(path.join(raiz, '.vercelignore'), 'utf8'), ignoreRepo);
  for (const n of ['scripts', '.github', 'release-rules.json', 'README.md', 'CONTRIBUTING.md']) prueba(`DEV: ${n} no está en el paquete`, fs.existsSync(path.join(d, n)), false);
  prueba('DEV: index.html sigue en el paquete', fs.existsSync(path.join(d, 'index.html')), true);
  // idempotencia sobre el mismo directorio
  const r2 = P.inyectarNoindexDev(d);
  prueba('DEV: segunda pasada no duplica noindex', P.listarHtml(path.join(d, 'demos')).filter((f) => (fs.readFileSync(f, 'utf8').match(/name\s*=\s*["']robots["']/gi) || []).length !== 1), []);
  prueba('DEV: segunda pasada reporta las mismas páginas', r2.demosHtml, htmlDemosRepo);
}

// ── DEV: una página de demos sin meta robots y otra con «index» reciben noindex
{
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-demos-u-'));
  fs.mkdirSync(path.join(d, 'demos', 'x'), { recursive: true });
  fs.writeFileSync(path.join(d, 'demos', 'a.html'), '<!doctype html><html><head><title>a</title></head><body></body></html>');
  fs.writeFileSync(path.join(d, 'demos', 'x', 'b.html'), '<!doctype html><html><head><meta name="robots" content="index, follow"></head><body></body></html>');
  P.inyectarNoindexDev(d);
  prueba('DEV: sin meta robots → se inyecta noindex', /noindex/.test(fs.readFileSync(path.join(d, 'demos', 'a.html'), 'utf8')), true);
  const b = fs.readFileSync(path.join(d, 'demos', 'x', 'b.html'), 'utf8');
  prueba('DEV: «index, follow» se reemplaza por noindex', /noindex/.test(b) && !/index, follow/.test(b), true);
  fs.writeFileSync(path.join(d, 'demos', 'c.html'), '<p>sin head</p>');
  let msg = ''; try { P.inyectarNoindexDev(d); } catch (e) { msg = e.message; }
  prueba('DEV (negativa): página sin <head> hace fallar el paquete', /no tiene <head>/.test(msg), true);
}

// ── PROD
for (const [etiqueta, env] of [['DEPLOY_ENV=prod', { DEPLOY_ENV: 'prod' }], ['sin DEPLOY_ENV (por defecto)', {}]]) {
  const d = copiaDelRepo();
  const r = cli(d, env);
  prueba(`PROD (${etiqueta}): el script termina bien`, r.status, 0);
  prueba(`PROD (${etiqueta}): el paquete NO contiene demos/`, rutas(d), []);
  prueba(`PROD (${etiqueta}): .vercelignore sigue excluyendo «demos»`, /^demos\s*$/m.test(fs.readFileSync(path.join(d, '.vercelignore'), 'utf8')), true);
  prueba(`PROD (${etiqueta}): no se inyecta noindex en el paquete`, /noindex/.test(fs.readFileSync(path.join(d, 'index.html'), 'utf8')) === /noindex/.test(fs.readFileSync(path.join(raiz, 'index.html'), 'utf8')), true);
  prueba(`PROD (${etiqueta}): index.html sigue en el paquete`, fs.existsSync(path.join(d, 'index.html')), true);
}

// ── Negativas de PROD
{
  const d = copiaDelRepo();
  prueba('verificarProd: paquete con demos/ → errores', P.verificarDemosProd(d).some((e) => /^demos\/.*no puede estar|^demos: /.test(e)), true);
  const e1 = copiaDelRepo(); fs.rmSync(path.join(e1, 'demos'), { recursive: true });
  prueba('verificarProd: sin demos/ y con .vercelignore correcto → sin errores', P.verificarDemosProd(e1), []);
  fs.writeFileSync(path.join(e1, '.vercelignore'), ignoreRepo.replace(/^demos\s*$/m, ''));
  prueba('verificarProd: .vercelignore sin «demos» → error', P.verificarDemosProd(e1).length, 1);
  const e2 = copiaDelRepo(); fs.writeFileSync(path.join(e2, '.vercelignore'), ignoreRepo.replace(/^demos\s*$/m, ''));
  const r = cli(e2, { DEPLOY_ENV: 'prod' });
  prueba('PROD (negativa): .vercelignore sin «demos» → el script falla', r.status, 1);
  const e3 = copiaDelRepo(); fs.mkdirSync(path.join(e3, 'demos-extra'), { recursive: true }); fs.writeFileSync(path.join(e3, 'demos-extra', 'x.html'), '<p>x</p>');
  fs.rmSync(path.join(e3, 'demos'), { recursive: true });
  prueba('guarda de prefijo exacto: «demos-extra/» NO cuenta como demos/', P.verificarDemosProd(e3), []);
  const e4 = copiaDelRepo(); fs.rmSync(path.join(e4, 'demos'), { recursive: true }); fs.mkdirSync(path.join(e4, 'sub', 'demos'), { recursive: true });
  prueba('guarda de prefijo exacto: «sub/demos/» NO cuenta (solo la raíz)', P.verificarDemosProd(e4), []);
  const e5 = copiaDelRepo(); fs.rmSync(path.join(e5, 'demos'), { recursive: true }); fs.writeFileSync(path.join(e5, 'demos'), 'archivo');
  prueba('guarda de prefijo exacto: un archivo llamado «demos» sí cuenta', P.verificarDemosProd(e5).length >= 1, true);
}

// ── Entorno inválido y protecciones
{
  const d = copiaDelRepo();
  const r = cli(d, { DEPLOY_ENV: 'staging' });
  prueba('DEPLOY_ENV inválido → el script falla', r.status, 1);
  prueba('DEPLOY_ENV inválido → no borra nada', fs.existsSync(path.join(d, 'scripts')) && fs.existsSync(path.join(d, 'demos')), true);
  let msg = ''; try { P.construirPaquete(d, 'Dev'); } catch (e) { msg = e.message; }
  prueba('construirPaquete: valor inválido lanza error', /DEPLOY_ENV/.test(msg), true);
  const sinForce = spawnSync(process.execPath, [path.join(d, 'scripts', 'prepare-deploy.js')], { cwd: d, encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_ACTIONS: '', DEPLOY_ENV: 'dev' }) });
  prueba('sin GITHUB_ACTIONS ni --force → se niega a borrar', sinForce.status, 1);
}

// ── Workflows
{
  const dev = fs.readFileSync(path.join(raiz, '.github/workflows/deploy-dev.yml'), 'utf8');
  const prod = fs.readFileSync(path.join(raiz, '.github/workflows/promote-prod.yml'), 'utf8');
  prueba('deploy-dev.yml usa DEPLOY_ENV: dev', /DEPLOY_ENV:\s*dev\s*\n\s*run:\s*node scripts\/prepare-deploy\.js/.test(dev), true);
  prueba('promote-prod.yml usa DEPLOY_ENV: prod', /DEPLOY_ENV:\s*prod\s*\n\s*run:\s*node scripts\/prepare-deploy\.js/.test(prod), true);
  prueba('deploy-dev.yml no menciona DEPLOY_ENV: prod', /DEPLOY_ENV:\s*prod/.test(dev), false);
  prueba('promote-prod.yml no menciona DEPLOY_ENV: dev', /DEPLOY_ENV:\s*dev/.test(prod), false);
}

if (fallos) { console.error(`\n✖ ${fallos} prueba(s) fallaron.`); process.exit(1); }
console.log('\n✔ Todas las pruebas del paquete de deploy pasaron.');
