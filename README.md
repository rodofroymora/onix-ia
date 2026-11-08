# Ónix Govern

Plataforma SaaS de gobierno de IA para organizaciones en México.

> Esta es la revisión inicial del monorepo (`feature/govern-v1`). No constituye certificación ni un dictamen legal.

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| `@onix/engine` | Lógica pura de madurez, brechas, triage, priorización y progreso |
| `@onix/db` | Esquema Drizzle + PGlite (local) / Postgres (prod) |
| `@onix/ui` | Tokens CSS (acento `#6E5BD8`, neutros cálidos, claro/oscuro) |
| `@onix/templates` | Cuestionario v1, plantillas sectoriales, biblioteca de acciones, catálogo IA |
| `@onix/agent` | Interfaz LLM + stubs con feature flags |

## Arranque local

```bash
pnpm install
pnpm test
pnpm build
```

Base de datos local (PGlite en `.data/govern.pg`):

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Lenguaje

Copia en español de México. Usamos «Revisión inicial», nunca «diagnóstico». No afirmamos certificación.
