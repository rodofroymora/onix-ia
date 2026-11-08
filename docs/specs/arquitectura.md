# Arquitectura — Ónix Govern v1

Monorepo pnpm + Turborepo.

```
apps/web                 Next.js App Router
packages/engine          Motor determinista
packages/db              Drizzle + PGlite/Postgres
packages/ui              Tokens
packages/templates       Cuestionario, sectores, acciones, catálogo
packages/agent           LLMProvider + stubs
```

Auth.js demo local; producción prevista con Supabase Auth detrás de adaptadores.
Dockerfile para `apps/web`. RLS en SQL para Postgres; `withOrg` + filtros en app para PGlite.
