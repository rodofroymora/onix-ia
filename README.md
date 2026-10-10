# ONIX · sitio web (onix-ia.com)

Sitio estático (HTML/CSS/JS, **sin build**) de ÓNIX, consultora de IA y datos. Producción: **https://onix-ia.com** (proyecto Vercel `agency-landing`).

## Estructura
- `index.html`, `servicios.html`, `como-trabajamos.html`, `confianza-y-gobierno.html`, `servicios/*.html` — páginas.
- `site.css`, `servicios.css`, `motion.js`, `nav.js`, `fonts/` — estilos, scripts y tipografías.
- `vercel.json` — `cleanUrls`, headers y `git.deploymentEnabled.main=false` (merge a `main` **no** publica).
- `release-rules.json` — cifras, plazos, precios, sectores y CTA aprobados (los llena CEO/Marketing).
- `scripts/checks/` — checks automáticos (Node 20, sin dependencias). `scripts/prepare-deploy.js` — deja solo archivos públicos en CI.
- `.github/` — workflows (`pr-checks`, `deploy-dev`, `promote-prod`), plantilla de PR, CODEOWNERS.
- `docs/` — `02_FLUJO_DE_RELEASES.md` (flujo completo) y `BRANCH_PROTECTION.md`.

## Flujo en una línea
`cambio/<corto>` → PR a `dev` (checks) → DEV se actualiza → PR `dev → main` con OK escrito de Rodolfo → **Promote to PROD** (aprobación manual). Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Probar local
```bash
node scripts/checks/run-all.js              # todos los checks
CHECK_BRANCH=main node scripts/checks/run-all.js
npx serve .   # opcional, para ver el sitio (cualquier servidor estático sirve)
```

## Reglas clave
Producción no se toca sin aprobación · nunca secretos en chats/docs/repo · un solo CTA (WhatsApp 2227097945) · cifras/precios/plazos/sectores solo los aprobados.
