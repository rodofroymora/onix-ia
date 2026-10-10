# Cómo contribuir al sitio de ONIX

Sitio estático (HTML/CSS/JS, sin build). Producción = **onix-ia.com**. Todo cambio pasa por PR; **nadie publica en producción sin el OK escrito de Rodolfo**. Detalle completo: [`docs/02_FLUJO_DE_RELEASES.md`](docs/02_FLUJO_DE_RELEASES.md).

## Ramas
| Rama | Qué es | Quién la toca |
|---|---|---|
| `main` | Lo que se puede publicar en producción. Protegida. Merge a `main` **no** publica. | Solo PR `dev → main` con OK escrito de Rodolfo |
| `dev` | Integración; se despliega al sitio DEV. Protegida. | Solo PR desde `cambio/*` |
| `cambio/<corto>` | Una rama por cambio, creada **desde `dev`**. | Quien hace el cambio |

Nombre: `cambio/<corto>` en minúsculas con guiones, p. ej. `cambio/hero-copy-escuelas`, `cambio/fix-enlace-footer`.

## Paso a paso
1. `git switch dev && git pull` → `git switch -c cambio/<corto>`
2. Edita y haz commits pequeños con mensaje claro en español (qué + por qué).
3. Corre los checks local: `CHECK_BRANCH=dev node scripts/checks/run-all.js` (Node 20, sin instalar nada).
4. Abre **PR → `dev`**, llena la plantilla (checklist + screenshot de preview). Los checks de CI deben pasar; no se hace merge con checks en rojo.
5. Revisión + merge a `dev` (squash recomendado) → se actualiza el sitio DEV automáticamente.
6. Cuando el CEO pida release: **PR `dev → main`**, con la referencia del **OK escrito de Rodolfo** en la descripción.
7. Merge a `main` (no publica). Publicar: Actions → **Promote to PROD** → `approval_text` + aprobación del Environment `production`.

## Reglas
- Nunca commitear `.env*`, `.vercel/`, tokens o claves. Nunca pegarlos en chats, issues, PRs o docs.
- Cifras, plazos, precios y sectores solo los aprobados en `release-rules.json` (los llena el CEO/Marketing).
- Un solo CTA primario por página.
- No hacer `vercel deploy` / `--prod` a mano. Solo los workflows.
- No hacer push directo a `dev` ni `main`; no force-push.
- Reportar al CEO; Rodolfo habla solo con el CEO.
