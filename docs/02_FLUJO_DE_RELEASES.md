# 02 · Flujo de releases del sitio ONIX

**Audiencia:** AI Engineer, Claude y demás agentes que tocan el sitio. **Versión:** borrador 2026-10-10 · **Repo:** `onix-site` (hoy solo local, sin remoto).
**Idea central:** todo cambio pasa por rama → PR → checks → `dev`; a producción (onix-ia.com) solo se llega con **OK escrito de Rodolfo** y un deploy manual aprobado. Un merge **nunca** publica.

## 1. Mapa de entornos

| Entorno | Qué es | URL | Quién/qué lo actualiza |
|---|---|---|---|
| **PROD** | Proyecto Vercel `agency-landing` (alias `onix-ia.com`, redirige a `www.onix-ia.com`) | https://onix-ia.com | **Solo** el workflow `Promote to PROD` (manual, aprobado por Rodolfo) |
| **DEV (hoy, provisional)** | Deployments *preview* dentro del **mismo** proyecto `agency-landing`. Con login de Vercel (SSO), `noindex`. Último al 2026-10-10 16:14 CDMX: `agency-landing-p43hnrwb5-rodofroymoras-projects.vercel.app` | cambia en cada deploy | Manual por CLI (agente) — **riesgo**: comparte proyecto con prod |
| **DEV (objetivo)** | Proyecto Vercel **separado** (nombre propuesto `onix-site-dev`) | `https://onix-site-dev.vercel.app` (propuesto; depende de que el nombre esté libre) | Workflow `Deploy DEV` al hacer push/merge a `dev` |
| **Local** | Repo `/workspace/onix-site` en la box | — | Cualquier agente; solo checks locales |

Copias antiguas (`/workspace/agency-landing` = recuperación de prod; `/workspace/agency-landing-dev` = copia previa de DEV) **no son fuente de verdad**: la fuente es el repo `onix-site`.

## 2. Ramas
- `main` — publicable. Protegida (PR + 1 aprobación de Rodolfo + checks). **No auto-publica** (`vercel.json → git.deploymentEnabled.main=false`).
- `dev` — integración; refleja el sitio DEV. Protegida (PR + checks).
- `cambio/<corto>` — un cambio por rama, **siempre desde `dev`** (ej. `cambio/hero-copy`).

## 3. Paso a paso para un cambio
1. **Rama:** `git switch dev && git pull && git switch -c cambio/<corto>`.
2. **Commit:** cambios pequeños, mensaje en español (qué + por qué). Sin `.env*`, `.vercel/` ni secretos.
3. **Checks local (opcional pero recomendado):** `CHECK_BRANCH=dev node scripts/checks/run-all.js`.
4. **PR → `dev`:** llenar la plantilla (checklist de cifras, plazos, precios, sectores, un solo CTA, enlaces, QA y **screenshot de preview** desktop + móvil).
5. **Preview y checks:** el workflow `PR checks` corre solo; deben quedar en verde. Rojo = no se fusiona (se corrige el cambio, o si la regla está mal, se pide al CEO actualizar `release-rules.json`).
6. **Merge a `dev`** (squash). Se dispara `Deploy DEV` → el sitio DEV queda actualizado. Verificar la URL DEV y avisar al CEO.
7. **Release:** cuando el CEO lo pida, abrir **PR `dev → main`** con la referencia del **OK escrito de Rodolfo** en la descripción. Checks (con regla robots de `main`) deben pasar.
8. **OK escrito de Rodolfo:** pasa por el CEO. Sin OK escrito no se hace merge a `main` ni promoción. (Un "sí" verbal o implícito no cuenta.)
9. **Promote:** GitHub → Actions → **Promote to PROD** → *Run workflow* en `main` → `approval_text` = referencia del OK (queda en el resumen del run). Los checks corren de nuevo sobre `main`; luego el Environment `production` espera la aprobación de Rodolfo; al aprobar, despliega a onix-ia.com.
10. **Verificar** en vivo (home, servicios, enlace de WhatsApp) y reportar al CEO.

## 4. Qué revisa la automatización (`scripts/checks/`, Node 20, sin dependencias)
| Check | Falla si… |
|---|---|
| 01 Cifras | Hay cifra/precio/plazo/sector en el HTML que no esté en `release-rules.json` (solo cuando esa lista no está vacía); WhatsApp distinto de 2227097945 / `wa.me/522227097945` |
| 02 CTA único | Una página tiene 0 CTAs o más de un CTA primario de marketing distinto (etiqueta/href), o no coincide con el CTA aprobado. **Excepción (decisión del CEO):** los botones de envío de formulario (`type=submit`, `<button>` dentro de `<form>`) no cuentan; ver `release-rules.json` → `cta.excepciones` |
| 03 Enlaces | Enlace interno, ancla `#id` o asset (css/js/img/font) roto |
| 04 QA smoke | Falta `lang`, `<title>`, meta description o `<h1>` (exactamente uno); `<img>` sin `alt`; texto TODO/lorem/placeholder; regla robots/noindex incorrecta para la rama (`dev` = noindex, `main` = index, configurable en `release-rules.json`) |
También: nombre de rama (`cambio/*` → `dev`, solo `dev` → `main`) y que no haya `.env*`/`.vercel/` versionados. Los checks **no arreglan contenido**: solo reportan.

## 5. Reglas
1. **Producción no se toca sin aprobación.** Nada de `vercel deploy`, `--prod`, `vercel promote`, cambios de settings/dominios del proyecto `agency-landing` por fuera del workflow aprobado.
2. **Nunca secretos en chats, PRs, issues ni docs** (tokens de Vercel/GitHub, `.env*`, `VERCEL_OIDC_TOKEN`). No copiar `.env*` ni `.vercel/` a ningún repo. Si se expone uno, avisar al CEO para rotarlo.
3. Cifras, plazos, precios y sectores: solo los aprobados por CEO/Marketing en `release-rules.json`. Un solo CTA primario de marketing por página (los botones de envío de formularios están exceptuados; ver `cta.excepciones` en `release-rules.json`).
4. Sin push directo a `dev`/`main`, sin force-push.
5. El contenido (copy) lo arreglan los agentes de contenido; el pipeline solo detecta.

## 6. Rollback (restaurar un deployment anterior en Vercel)
Producción = proyecto `agency-landing`. Los deployments anteriores siguen disponibles.
- **Dashboard (más rápido):** Vercel → proyecto `agency-landing` → *Deployments* → elegir el deployment previo que estaba en *Production* → ⋮ → **Instant Rollback** → confirmar.
- **CLI:** `vercel rollback <url-del-deployment-anterior>` (o `vercel promote <url>`). El deployment previo queda anotado en el resumen de cada run de `Promote to PROD` («Deployment de producción ANTES de esta promoción»).
- **Ojo:** tras un rollback, Vercel **desactiva la asignación automática** del dominio: un nuevo `Promote to PROD` **no** reemplazará lo restaurado hasta hacer *Undo Rollback* / `vercel promote <deployment>`. Dejarlo documentado al CEO.
- **Rollback por código:** `git revert` del merge en `main` vía PR `dev → main` con OK de Rodolfo + `Promote to PROD` (más lento; úsese cuando no hay urgencia).
- Todo rollback requiere aviso inmediato al CEO; en emergencia, Rodolfo/CEO pueden autorizarlo y el agente documenta después.

## 7. Roles
- **Rodolfo:** dueño; da el OK escrito para producción y aprueba el Environment `production`. **Habla solo con el CEO.**
- **CEO:** único interlocutor de Rodolfo; transmite solicitudes y el OK escrito; aprueba/llena `release-rules.json` con Marketing.
- **Marketing:** aprueba cifras, plazos, precios, sectores y CTA.
- **AI Engineer:** implementa cambios técnicos, mantiene el repo/pipeline.
- **Claude y otros agentes:** cambios de contenido/código vía PR a `dev`; **reportan al CEO**, nunca a Rodolfo directamente.

## 8. Pendientes (bloqueados por credenciales/aprobaciones)
1. Crear el repo en GitHub y su URL; agregar remoto y empujar `main` y `dev`; confirmar el usuario real para `CODEOWNERS` (placeholder `@rodofroymora`).
2. Token/acceso de GitHub con permisos de admin para aplicar `docs/BRANCH_PROTECTION.md`.
3. **Crear el proyecto Vercel DEV separado** (p. ej. `onix-site-dev`, framework *Other*, sin conexión a dominio de producción) y anotar su `projectId` → secreto `VERCEL_DEV_PROJECT_ID`; URL esperada `https://onix-site-dev.vercel.app` (o la que Vercel asigne).
4. Secretos de GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID` (team de Vercel), `VERCEL_DEV_PROJECT_ID`, y en el environment `production`: `VERCEL_PROD_PROJECT_ID` (+ token de prod).
5. GitHub Environment `production` con Rodolfo como revisor requerido (y `dev`).
6. **No** instalar la app de Vercel para GitHub sobre `agency-landing` sin antes confirmar que `main` no auto-publica (`git.deploymentEnabled.main=false` ya está en `vercel.json`; confirmar también en Settings → Git). Si se instala, decidir con el CEO.
7. **Decisión noindex en producción:** `vercel.json`, `robots.txt` y cada `<meta robots>` del sitio actual tienen `noindex`. El check de `main` exige `index`, así que fallará hasta que el CEO decida el lanzamiento y se retire el `noindex` en el release. Sugerido: aplicar noindex solo en el deploy DEV (no versionado en el contenido) cuando se defina.
8. CEO/Marketing: llenar `release-rules.json` (cifras, plazos, precios, sectores, CTA).
9. Rodolfo/CEO: confirmar plan de GitHub (protección de ramas en repos privados requiere plan de pago).
10. Resolver hallazgos actuales del sitio (ver reporte de checks): ~~CTA doble en `index.html` (botón "Enviar" del formulario)~~ (resuelto: los submit de formulario quedan exceptuados), `noindex` en main; avisos de longitud de title/description.
11. Separar definitivamente DEV de PROD en Vercel y dejar de usar previews del proyecto `agency-landing` como "DEV".
