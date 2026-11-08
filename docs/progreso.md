# Progreso — Ónix Govern v1

| Caso / hito | Estado | Pruebas | Pendientes |
|---|---|---|---|
| Hito 0 Monorepo, auth, tokens, CI | Hecho | web vitest + CI workflow | 2FA real |
| Hito 1 Modelo, RLS, seed | Hecho | rls-org-isolation | RLS nativo en PGlite |
| Hito 2 Engine | Hecho | 26 tests engine | — |
| CU-01 Alta org | Hecho | e2e parcial | — |
| CU-02/03 Evaluación + portal | Hecho | respondent-token | Correo Resend prod |
| CU-04 Resultados | Hecho | engine + UI | — |
| CU-05/07 Inventario + triaje | Hecho | engine triage | — |
| CU-08 Priorización | Hecho | engine prioritization | Heurística demo |
| CU-09/12 Plan + avance | Hecho | engine progress/projected | — |
| CU-10/11 Tablero + reporte | Hecho | e2e happy path | PDF nativo |
| CU-13 Reevaluación | Stub (flag v1_5) | — | Completar en v1.5 |
| CU-06 Descubrimiento | Fuera de alcance | origen discovery | Conectores Microsoft |
| Asistente | Stub (flag) | — | Proveedor LLM real |
| Pulido a11y/copy | Parcial | — | Auditoría AA completa |

## Pendientes v1.5
- Comparativo completo y reevaluación guiada
- PDF con React-PDF o Playwright
- Supabase Auth + MFA
- RLS nativo verificado en Postgres managed
- Asistente con proveedor real detrás de `LLMProvider`
