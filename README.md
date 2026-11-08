# Ónix Govern

Plataforma SaaS de gobierno de IA para organizaciones en México.

> Revisión inicial orientativa. No constituye certificación ni un dictamen legal.

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| `@onix/engine` | Lógica pura de madurez, brechas, triage, priorización y progreso |
| `@onix/db` | Esquema Drizzle + PGlite (local) / Postgres (prod) |
| `@onix/ui` | Tokens CSS (acento `#6E5BD8`, neutros cálidos, claro/oscuro) |
| `@onix/templates` | Cuestionario v1, plantillas sectoriales, biblioteca de acciones, catálogo IA |
| `@onix/agent` | Interfaz LLM + stubs con feature flags |
| `@onix/web` | App Next.js (Auth.js demo, Ruta IA, CU v1) |

## Arranque local

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter @onix/web dev
```

También: `pnpm dev` (alias a la app web).

Abre http://localhost:3000 e inicia sesión con un usuario demo (`consultant@onix-ia.com`, `admin@altamar.demo` o `lector@altamar.demo`) y la contraseña definida en `DEMO_PASSWORD` (ver `apps/web/.env.local`).

Seed crea **Grupo Altamar (demo)** con evaluación publicada, inventario, plan e informe.

## Calidad

```bash
pnpm test
pnpm build
pnpm test:e2e   # requiere build previo de @onix/web + Playwright browsers
```

## Variables

Copia `.env.example` → `.env` / `apps/web/.env.local`. Ver `docs/decisions.md` para atajos de v1.

## Lenguaje

Copia en español de México (tú). Usamos «Revisión inicial», nunca «diagnóstico». No afirmamos certificación.
