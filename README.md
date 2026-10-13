# ONIX · sitio web (onix-ia.com)

Sitio estático (HTML/CSS/JS, **sin build**) de ÓNIX, consultora de IA y datos. Producción: **https://onix-ia.com**.

## Estructura
- `index.html`, `servicios.html`, `como-trabajamos.html`, `confianza-y-gobierno.html`, `servicios/*.html` — páginas.
- `site.css`, `servicios.css`, `motion.js`, `nav.js`, `fonts/` — estilos, scripts y tipografías.
- `vercel.json` — `cleanUrls`, headers y `git.deploymentEnabled.main=false` (merge a `main` **no** publica).
- `release-rules.json` — cifras, plazos, precios, sectores y CTA aprobados (aprobados por el responsable de contenido).
- `scripts/checks/` — checks automáticos (Node 20, sin dependencias). `scripts/prepare-deploy.js` — deja solo archivos públicos en CI y, según `DEPLOY_ENV` (`dev`/`prod`), inyecta noindex (DEV) o verifica que el paquete sea indexable (PROD); `scripts/verify-deploy.js` — verifica la indexación ya desplegada.
- `.github/` — workflows (`pr-checks`, `deploy-dev`, `promote-prod`), plantilla de PR, CODEOWNERS.

## Flujo en una línea
`cambio/<corto>` → PR a `dev` (checks) → DEV se actualiza → PR `dev → main` con OK escrito del dueño del sitio → **Promote to PROD** (aprobación manual). Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Probar local
```bash
node scripts/checks/run-all.js              # todos los checks
CHECK_BRANCH=main node scripts/checks/run-all.js
npx serve .   # opcional, para ver el sitio (cualquier servidor estático sirve)
```

## Reglas clave
Producción no se toca sin aprobación · nunca secretos en el repo · un solo CTA (WhatsApp 2227097945) · cifras/precios/plazos/sectores solo los aprobados.
