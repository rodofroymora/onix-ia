# Cómo contribuir al sitio de ONIX

Sitio estático (HTML/CSS/JS, sin build). Todo cambio pasa por Pull Request (PR) y por checks automáticos. **Nada se publica en producción sin el OK escrito del dueño del sitio.**

## Ramas
| Rama | Qué es | Cómo se actualiza |
|---|---|---|
| `main` | Código que se puede publicar en producción. Protegida. Un merge a `main` **no** publica. | Solo con un PR `dev → main` y el OK escrito del dueño del sitio |
| `dev` | Integración; se despliega al sitio de pruebas (DEV). Protegida. | Solo con PR desde `cambio/*` |
| `cambio/<corto>` | Una rama por cambio, creada **desde `dev`**. | Quien hace el cambio |

Nombre de la rama: `cambio/<corto>`, en minúsculas y con guiones, p. ej. `cambio/hero-copy-escuelas` o `cambio/fix-enlace-footer`.

## Paso a paso
1. `git switch dev && git pull`, luego `git switch -c cambio/<corto>`.
2. Haz commits pequeños con mensajes claros en español (qué + por qué).
3. Corre los checks en local: `CHECK_BRANCH=dev node scripts/checks/run-all.js` (Node 20, sin instalar nada).
4. Abre un **PR hacia `dev`** y llena la plantilla. Los checks de CI deben pasar; no se hace merge con checks en rojo.
5. Tras la revisión, merge a `dev` (se recomienda squash). El sitio DEV se actualiza automáticamente.
6. Para un release: PR **`dev → main`**, con la referencia del OK escrito del dueño del sitio en la descripción. El merge a `main` no publica.
7. La publicación en producción es **manual**: solo se hace con el workflow *Promote to PROD*, que exige la referencia del OK escrito y la aprobación de su Environment protegido.

## Checks que se ejecutan en cada PR
- **Flujo de ramas:** a `dev` solo desde `cambio/*`; a `main` solo desde `dev`.
- **Cifras, plazos, precios y sectores:** solo se permiten los valores aprobados en `release-rules.json`.
- **Un solo CTA:** un único CTA primario de marketing por página (WhatsApp, con la misma etiqueta y destino).
- **Enlaces y assets:** enlaces internos, anclas e imágenes/archivos deben existir.
- **QA smoke:** title, meta description, `lang`, un solo `h1`, imágenes con `alt`, sin texto residual (TODO, lorem, placeholder) y regla de indexación según la rama.
- **Frases prohibidas:** `release-rules.json` → `frasesProhibidas`. Las de nivel `bloqueante` hacen fallar el PR; las de nivel `advertencia` se muestran para revisión manual y no bloquean.
- **Textos obligatorios:** `release-rules.json` → `textosObligatorios`. Las páginas demo deben llevar el aviso de datos ficticios y la palabra «Ilustrativo»; Contabilidad Asistida, el aviso de que ÓNIX no presta servicios contables ni fiscales; y cada enlace de WhatsApp debe tener cerca un enlace «Aviso de privacidad de ÓNIX».
- **Higiene:** no se versionan `.env*`, `.vercel/` ni `node_modules/`.

## Reglas
- Nunca subas `.env*`, `.vercel/`, tokens o claves, ni los pegues en issues, PRs o comentarios.
- **Excepción de formularios:** los botones de envío de formularios (`<button type="submit">`, cualquier `<button>` dentro de un `<form>` e `<input type="submit">`) no cuentan como CTA y no se validan contra el CTA aprobado. Un enlace `<a>` con `btn--primary`/`btn--accent` sí cuenta, aunque esté dentro de un formulario. Está registrada en `release-rules.json` → `cta.excepciones`.
- **Excepción del mensaje precargado de WhatsApp:** el CTA aprobado puede llevar el parámetro `?text=...` (único parámetro permitido). Otro número, otra ruta u otro parámetro hacen fallar el check. Ver `release-rules.json` → `cta.excepciones`.
- No publiques en producción a mano; solo mediante los workflows.
- No hagas push directo a `dev` ni a `main`, ni force-push.
