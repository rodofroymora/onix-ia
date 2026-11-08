# Ónix Govern v1 — especificación de casos de uso

> **Origen:** documento fuente «Ónix Govern v1: especificación de casos de uso» no encontrado en Notion ni Drive (2026-11-08). Esta versión se sintetizó desde el prompt maestro de ingeniería y la lógica de `autoevaluacion-logica.js`. Ver `docs/decisions.md` D-001.
>
> Revisión inicial orientativa. Con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador.

## 1. Visión del producto

**Ónix Govern** es una plataforma SaaS multi-tenant de gobierno de IA para empresas medianas en México. La opera un consultor de Ónix; la usan sus clientes (administradores y lectores). El respondente contesta evaluaciones con un enlace mágico, sin crear cuenta.

La Ruta IA del producto tiene cuatro fases visibles: **Evaluación → Inventario → Priorización → Plan**.

## 2. Actores y roles

| Rol | Quién | Puede |
|---|---|---|
| `consultant` | Consultor Ónix | Todas las orgs, plantillas, bitácora, publicar resultados |
| `client_admin` | Admin del cliente | Su org: lanzar evaluación, inventario, pesos, plan, evidencias |
| `client_reader` | Lector del cliente | Solo lectura de lo publicado |
| Respondente | Persona invitada | Contestar cuestionario vía enlace firmado |

Reglas de visibilidad:
- El cliente no ve resultados hasta que el consultor los publica.
- El cliente no ve respuestas individuales salvo habilitación explícita.
- El nivel oficial de madurez solo cambia con evaluación o reevaluación.
- Las proyecciones se guardan aparte.

## 3. Entidades mínimas

Organization, User, Membership, ResponsibilityMap, QuestionnaireVersion, Question, Assessment, Invitation, Answer, DimensionResult, Gap, TechProfile, AIUseCase, TriageValidation, PrioritizationWeights, PrioritizationScore, Plan, Stage, Action, Evidence, Report (snapshot), AuditLog.

Toda tabla de negocio lleva `organization_id` y aislamiento multi-tenant.

## 4. Motor de cálculo (determinista)

Seis dimensiones: Estrategia y valor, Roles y decisiones, Datos y privacidad, Riesgo y control, Seguridad y tecnología, Personas y cultura.

Cuatro niveles: Inicial, En exploración, Definido, Gestionado.

Tres rutas de cuestionario SaaS: Rápida (15), Estándar (27), Completa (38).

Tres etapas de plan: Bases, Controles, Mejora continua.

Reglas que no se rompen:
1. Caso con riesgo **Inaceptable** nunca se recomienda ni pasa a producción.
2. Controles de casos Alto o Inaceptable entran como críticos en Bases y no se eliminan.
3. Ninguna acción llega a 100% ni se cierra sin evidencia aprobada; evidencia rechazada regresa a 75%.
4. Una pregunta sube como máximo un nivel por ciclo; Gestionado exige tres meses operando; la meta no sube más de 1.5 puntos en doce meses.
5. Brecha: dos respondentes difieren dos niveles o más en la misma pregunta.
6. Si dos validadores del triaje no coinciden, gana el nivel más alto.
7. El asistente solo sugiere: etiqueta «Sugerencia», cita fuente, aprueba una persona, queda en bitácora. Los cálculos oficiales los hace el motor.

## 5. Casos de uso (índice)

| ID | Nombre | Detalle |
|---|---|---|
| CU-01 | Alta de organización | `cu-01.md` |
| CU-02 | Lanzar evaluación | `cu-02.md` |
| CU-03 | Portal del respondente | `cu-03.md` |
| CU-04 | Tablero de resultados y brechas | `cu-04.md` |
| CU-05 | Inventario de casos de IA | `cu-05.md` |
| CU-06 | Descubrimiento IA | Fuera de v1 (solo origen `discovery`) |
| CU-07 | Triaje con validación humana | `cu-07.md` |
| CU-08 | Priorización | `cu-08.md` |
| CU-09 | Plan por etapas | `cu-09.md` |
| CU-10 | Tablero ejecutivo vivo | `cu-10.md` |
| CU-11 | Reporte exportable | `cu-11.md` |
| CU-12 | Backlog y avance | `cu-12.md` |
| CU-13 | Reevaluación y comparativo | `cu-13.md` (flag `v1_5`) |

## 6. Navegación (9 vistas)

Inicio, Evaluación, Inventario, Priorización, Plan, Reportes, Organización, Organizaciones (consultor), Administración (consultor). Más portal `/r/[token]`. Fichas en paneles laterales. Profundidad máxima: 2.

## 7. Integraciones v1

Correo transaccional (plantillas), WhatsApp `wa.me` con texto, Excel import/export, PDF (vista impresión en v1), LLM detrás de `LLMProvider` sin entrenar con datos del cliente.

## 8. No funcionales

Vistas demo < 2 s, accesibilidad AA, sin secretos en logs, bitácora append-only (retención 2 años), hospedaje Vercel + Supabase con Dockerfile para migrar a Azure México.
