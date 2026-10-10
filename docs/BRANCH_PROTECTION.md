# Plan de protección de ramas (aplicar cuando exista el repo en GitHub)

> **Estado: NO aplicado.** El repo solo existe en local (sin remoto). Este archivo es el plan exacto para aplicar después, con un usuario/token con permisos de admin del repo.
> Reemplazar `OWNER/REPO` (p. ej. `rodofroymora/onix-site`) y `RODOLFO_USER_ID`. Requiere `gh` autenticado (`gh auth login`) — **nunca pegar el token en chats/docs**.

## 0. Prerrequisitos
- Repo creado y con las ramas `main` y `dev` empujadas (`git push -u origin main dev`), y `dev` como rama por defecto **no** (la por defecto es `main`).
- Los workflows deben haberse ejecutado al menos una vez para que el status check exista: el job se llama **`Checks de release`** (workflow `PR checks`).
- Plan de GitHub: la protección de ramas en repos **privados** requiere GitHub Pro/Team (en Free solo para repos públicos). Si no aplica, usar repo público (sin secretos en él) o subir de plan.
- Para que "1 aprobación de Rodolfo" sea posible, los PRs deben abrirse con otra cuenta (el autor no puede aprobar su propio PR). Usar una cuenta/bot de los agentes para abrir PRs.

## 1. Rama `main` (producción)
Reglas: PR obligatorio · 1 aprobación (de Rodolfo vía CODEOWNERS) · status check `Checks de release` obligatorio y rama al día · sin force push · sin borrar · reglas también para admins · conversaciones resueltas.

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Checks de release"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```
`CODEOWNERS` (`* @rodofroymora`, placeholder: confirmar usuario real) hace que la aprobación obligatoria sea la de Rodolfo.

## 2. Rama `dev` (integración / DEV)
Reglas: PR obligatorio (1 aprobación de cualquier revisor) · status check obligatorio · sin force push · sin borrar.

```bash
gh api -X PUT repos/OWNER/REPO/branches/dev/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Checks de release"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": false,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```
(Si el equipo es una sola persona + agentes y la revisión humana en dev es excesiva, bajar `required_approving_review_count` a `0`: el PR y los checks siguen siendo obligatorios.)

## 3. Merge settings del repo
```bash
gh api -X PATCH repos/OWNER/REPO \
  -f allow_squash_merge=true -f allow_merge_commit=true -f allow_rebase_merge=false \
  -F delete_branch_on_merge=true -f default_branch=main
```
(`dev → main` conviene con *merge commit* para conservar el historial de dev; `cambio/* → dev` con *squash*.)

## 4. Environment `production` (revisor: Rodolfo) y secretos
```bash
# ID numérico de Rodolfo
gh api users/rodofroymora --jq .id        # → RODOLFO_USER_ID  (confirmar usuario real)

# Crear environment con revisor requerido y solo desde main
gh api -X PUT repos/OWNER/REPO/environments/production --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [ { "type": "User", "id": RODOLFO_USER_ID } ],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
gh api -X POST repos/OWNER/REPO/environments/production/deployment-branch-policies -f name=main -f type=branch

# Secretos (se piden por prompt; NO escribirlos en la línea de comandos ni en chats)
gh secret set VERCEL_TOKEN           --env production
gh secret set VERCEL_ORG_ID          --env production
gh secret set VERCEL_PROD_PROJECT_ID --env production
# DEV (a nivel repo; apuntan al proyecto Vercel DEV, nunca al de producción)
gh secret set VERCEL_TOKEN           
gh secret set VERCEL_ORG_ID          
gh secret set VERCEL_DEV_PROJECT_ID  
```
Recomendación: usar un **token de Vercel distinto** para DEV y para PROD (el de PROD solo en el environment `production`).

## 5. Verificación
```bash
gh api repos/OWNER/REPO/branches/main/protection --jq '{checks: .required_status_checks.contexts, approvals: .required_pull_request_reviews.required_approving_review_count, codeowners: .required_pull_request_reviews.require_code_owner_reviews, force: .allow_force_pushes.enabled}'
gh api repos/OWNER/REPO/branches/dev/protection  --jq '{checks: .required_status_checks.contexts, force: .allow_force_pushes.enabled}'
gh api repos/OWNER/REPO/environments/production --jq '{reviewers: [.protection_rules[]?.reviewers[]?.reviewer.login]}'
```
Prueba: abrir un PR de prueba con un cambio que rompa un check → el botón de merge debe quedar bloqueado.

## 6. Vercel (fuera de GitHub)
- **No instalar la app de Vercel en GitHub para el proyecto de producción** (o, si se instala, mantener `git.deploymentEnabled.main=false` de `vercel.json`, ya incluido, y confirmar en Settings → Git del proyecto `agency-landing`: *Production Branch* sin deploy automático / Ignored Build Step).
- El proyecto DEV (separado) se despliega solo por CLI desde `deploy-dev.yml`; no necesita conexión Git.
