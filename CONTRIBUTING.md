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
- **Frases prohibidas:** `release-rules.json` → `frasesProhibidas`. Las de nivel `bloqueante` hacen fallar el PR; las de nivel `advertencia` se muestran para revisión manual y no bloquean. «cerrar ventas», «cierra/cerramos ventas» y «Pedido confirmado» son bloqueantes.
- **Excepciones por ruta** (`release-rules.json` → `excepcionesPorRuta`; no son aprobaciones generales): `aviso-de-privacidad.html` está exento de cifras, plazos y fechas, y de las palabras exactas «tratamiento» y «salud». Los términos de salud (`salud`, `consultorio`, `paciente`…) solo se permiten en `/salud` (`rutasConSectorPermitido`). «clínica/clínicas» y «diagnóstico» no se permiten en ninguna página. Las guardas están en `scripts/checks/lib.js` y cambiarlas requiere revisión de código.
- **Indexación (robots):** el **fuente** es indexable en `dev` y en `main`: ninguna página con `<meta name="robots" content="noindex">`, `robots.txt` sin `Disallow: /` y con la línea `Sitemap:` exacta de `robots.sitemapUrl` (**bloqueante**; se evalúa sobre el `robots.txt` del fuente, no sobre el que DEV inyecta al desplegar), `sitemap.xml` presente y válido con todas sus `<loc>` en el mismo host, y `vercel.json` sin header `X-Robots-Tag` noindex; cualquier incumplimiento hace fallar el PR, salvo la ruta `/salud` y sus subrutas (`release-rules.json` → `robots.rutasNoindex`; la guarda de `lib.js` rechaza cualquier otra ruta). El sitio **DEV sigue siendo noindex**, pero se inyecta **al desplegar** (`scripts/prepare-deploy.js` con `DEPLOY_ENV=dev`: `robots.txt` con `Disallow: /`, header `X-Robots-Tag` y meta noindex en el paquete) y el workflow lo verifica después; con `DEPLOY_ENV=prod` nunca se inyecta y se aborta si el paquete no es indexable. **`/salud` no debe ir a `main` hasta la revisión de un abogado humano y el OK escrito del dueño del sitio** (no hay compuerta automática).
- **Marcadores pendientes (H-39, solo `main`):** `release-rules.json` → `bloqueosSoloMain`. Con `CHECK_BRANCH=main` el check 04 falla si el paquete público (páginas `.html` fuera de `demos/`, `sitemap.xml`, `robots.txt`) contiene «FECHA DE VIGENCIA» o «borrador» (incl. «v3-borrador») en cualquier parte del código (texto, atributos, comentarios, JSON-LD), con archivo:línea. En `dev` no bloquea (el marcador existe hasta que corre el paso de go-live). *Promote to PROD* lo vuelve a comprobar sobre `main` y sobre el paquete antes de desplegar, y verifica después que `/aviso-de-privacidad` no lo contiene. Riesgo de falso positivo: «borrador» es subcadena (también «borradores»); si el copy público necesita esa palabra, hay que reformular o cambiar la regla con revisión de código.
- **Textos obligatorios:** `release-rules.json` → `textosObligatorios`. Las páginas demo deben llevar la leyenda «Demostración con información de ejemplo. Por favor, no incluyas datos personales reales.» (literal exacto; la leyenda «Ilustrativo» ya no se exige); Contabilidad Asistida, el aviso de que ÓNIX no presta servicios contables ni fiscales; y cada enlace de WhatsApp debe tener cerca un enlace «Aviso de privacidad de ÓNIX».
- **Higiene:** no se versionan `.env*`, `.vercel/` ni `node_modules/`.

## Reglas
- Nunca subas `.env*`, `.vercel/`, tokens o claves, ni los pegues en issues, PRs o comentarios.
- **Excepción de formularios:** los botones de envío de formularios (`<button type="submit">`, cualquier `<button>` dentro de un `<form>` e `<input type="submit">`) no cuentan como CTA y no se validan contra el CTA aprobado. Un enlace `<a>` con `btn--primary`/`btn--accent` sí cuenta, aunque esté dentro de un formulario. Está registrada en `release-rules.json` → `cta.excepciones`.
- **Excepción de «Contáctanos» (ancla interna):** un enlace `<a href="#id">` con texto exacto «Contáctanos» (menú, menú móvil, botón flotante) cuyo `id` existe en la página y es —o contiene— el botón de WhatsApp aprobado **no** cuenta como CTA. Cualquier otro enlace o botón con `btn--primary`/`btn--accent` sigue contando (otro texto, `/#id` con barra, id inexistente, etc.). Ver `release-rules.json` → `cta.excepciones` (`contactanos-ancla-interna`).
- **Excepción del mensaje precargado de WhatsApp:** el CTA aprobado puede llevar el parámetro `?text=...` (único parámetro permitido). Otro número, otra ruta u otro parámetro hacen fallar el check. Ver `release-rules.json` → `cta.excepciones`.
- No publiques en producción a mano; solo mediante los workflows.
- No hagas push directo a `dev` ni a `main`, ni force-push.
