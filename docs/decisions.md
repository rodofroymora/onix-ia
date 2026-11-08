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
