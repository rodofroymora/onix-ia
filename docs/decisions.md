# Decisiones de arquitectura — Ónix Govern

## D-001 — Origen de la especificación

La especificación original en Notion/Drive no se encontró en el entorno de trabajo.

Se sintetizó el alcance de Govern v1 a partir del **master prompt** del agente y de la lógica publicada en `_ref-autoevaluacion-logica.js` (portada a `@onix/engine`).

Implicaciones:

- El cuestionario se expandió conceptualmente a 38 preguntas de madurez (rutas SaaS 15/27/38) manteniendo compatibilidad de scoring con el modelo de 12 + factores de caso.
- La copia usa «Revisión inicial» (nunca «diagnóstico») y no afirma certificación.

## D-002 — Base de datos local vs producción

- **Local:** [PGlite](https://pglite.dev/) con archivo en `.data/govern.pg` para `db:migrate` / `db:seed` sin Docker.
- **Producción:** Postgres gestionado; mismo esquema Drizzle y políticas RLS (`packages/db/sql/rls.sql`).

El aislamiento multi-tenant se basa en `organization_id` + `govern_current_org()` / `govern_set_org()`.

## D-003 — Auth demo sin Supabase

Auth.js (next-auth v5) con Credentials. Usuarios demo fijados en código; la fila en `users`/`memberships` la crea el seed. Contraseñas no se hashean en BD en v1 (solo demo local).

Roles de sesión: `consultant` | `client_admin` | `client_reader` (mapeados a memberships owner/admin/viewer).

El `authorize` lee `.data/demo-auth.json` (escrito por `db:seed`) para no abrir PGlite dentro del bundle de Auth.js/Next (PGlite + webpack rompe `fs.readFile` con `URL`).

## D-004 — Portal respondente

Magic link firmado HMAC (`RESPONDENT_TOKEN_SECRET`), un solo uso (`invitations.status → accepted`), con expiración. El seed también deja un token plano para demos locales.

## D-005 — Exportación PDF

v1 usa vista HTML de impresión (`/print/reportes/[id]`). `@react-pdf/renderer` / Playwright PDF quedan para iteración posterior.

## D-006 — Atajos de UI v1

- Cmd+K y bandeja de pendientes: stubs.
- Comparativo y reevaluación: detrás de `FEATURE_V1_5`.
- Asistente: detrás de `FEATURE_ASSISTANT`; solo stubs de resumen/borrador.
- Priorización: matriz con heurística de criterios demo a partir del inventario + pesos editables.
- CU-06: `origin=discovery` fuerza `status=Propuesto` en servidor.

## D-007 — RLS en PGlite local

Las políticas RLS (+ `FORCE ROW LEVEL SECURITY`) están en `packages/db/sql/rls.sql` para Postgres de producción.

En PGlite local el filtrado nativo de RLS no es fiable; la app usa `withOrg` (setea `govern_set_org`) **y** filtros explícitos por `organization_id` en lecturas/escrituras. El test de aislamiento verifica helpers + filtro de app.
