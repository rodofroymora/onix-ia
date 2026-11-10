# Conectores de descubrimiento (Ónix Govern)

Ónix lee, con permisos de solo lectura, qué apps de IA y agentes existen en la nube del cliente.
Las conexiones se administran en **Agent Discovery, pestaña Conexiones**: un catálogo de integraciones donde cada una muestra qué descubre, qué permisos pide y sus parámetros. Lo detectado aparece en **Agent Discovery, pestaña Detectados**, donde el equipo decide si lo registra, lo vincula con un agente que ya existe o lo ignora.
Los conectores se revisan cada día con la tarea programada (`/api/cron/recordatorios`) y también con el botón "Revisar ahora" en el panel de cada integración.

## Variables de entorno (Vercel)

| Variable | Para qué | Quién la pone |
|---|---|---|
| `CONNECTOR_ENC_KEY` | Cifra los tokens de los clientes (AES-256-GCM). Texto aleatorio de 32 caracteres o más. Si cambia, hay que reconectar. | Rodolfo |
| `MS_CLIENT_ID` | Id. de la app de Entra "Ónix Govern" | Rodolfo |
| `MS_CLIENT_SECRET` | Secreto de esa app | Rodolfo |
| `ONIX_AWS_ACCOUNT_ID` | Cuenta de AWS de Ónix (aparece en la política de confianza) | Rodolfo |
| `ONIX_AWS_ACCESS_KEY_ID` / `ONIX_AWS_SECRET_ACCESS_KEY` | Usuario IAM de Ónix que solo puede `sts:AssumeRole` | Rodolfo |

Sin estas variables, la tarjeta de cada conector dice "Lo activa tu consultor de Ónix". La demo de Grupo Altamar usa conectores de ejemplo y no las necesita.

## Microsoft 365 y Entra ID

Qué descubre:
- **Entra ID:** apps de IA de terceros autorizadas con cuentas de la empresa (ChatGPT, Claude, Otter, Fireflies, etc.), cuántas personas las autorizaron y qué permisos tienen. El riesgo sugerido sale de esos permisos.
- **Power Platform:** agentes de Copilot Studio y del Agent Builder de M365, con su creador y entorno.

### Registrar la app de Ónix (una sola vez, en el tenant de Ónix)
1. Entra admin center, App registrations, New registration. Nombre "Ónix Govern". Tipo de cuentas: **cualquier directorio organizacional (multitenant)**.
2. Redirect URI, plataforma Web: `https://onix-govern.vercel.app/api/conectores/microsoft/callback` (y la del dominio propio cuando exista).
3. Certificates & secrets, New client secret. Copiar el valor a `MS_CLIENT_SECRET` y el Application (client) ID a `MS_CLIENT_ID`.
4. API permissions, todos **delegados**:
   - Microsoft Graph: `Application.Read.All`, `DelegatedPermissionGrant.Read.All`, `User.Read`, `offline_access`, `openid`, `profile`.
   - Power Platform API (app id `8578e004-a5c6-46e7-913e-12f58912df43`): `ResourceQuery.Resources.Read`. Si no aparece, crear su service principal con `New-MgServicePrincipal -AppId 8578e004-a5c6-46e7-913e-12f58912df43`.

### Lo que hace el cliente
1. En Agent Discovery, Conexiones, Microsoft 365: elige qué revisar (apps de Entra, agentes de Copilot Studio), su dominio (opcional) e "Iniciar sesión con Microsoft".
2. Entra con una cuenta que tenga **Global Reader** o **Cloud Application Administrator**, más **AI Reader** o **Power Platform Administrator** para ver los agentes.
3. Acepta los permisos marcando "Consentir en nombre de la organización".

Notas:
- El inventario de Power Platform solo acepta usuarios (no apps), por eso se usa un token delegado que se guarda cifrado y se renueva en cada revisión.
- Si la cuenta que conectó pierde sus roles o se desactiva, el conector queda "Con error" y pide volver a conectar.
- La API de paquetes de Copilot (`/beta/copilot/admin/catalog/packages`) queda fuera por ahora: está en preview y pide licencia de Agent 365.

## Amazon Web Services

Qué descubre: agentes de Amazon Bedrock (`ListAgents`) y de Bedrock AgentCore (`ListAgentRuntimes`) en las regiones elegidas.

### Lo que hace el cliente
1. En Agent Discovery, Conexiones, Amazon Bedrock, "Empezar conexión con AWS". Ónix genera un ExternalId único.
2. En IAM crea un rol para "Otra cuenta de AWS" con la política de confianza que muestra Ónix (cuenta de Ónix y ExternalId).
3. Le agrega la política de solo lectura que muestra Ónix.
4. Pega el ARN del rol y elige regiones.

## Próximamente
Gemini Enterprise, ChatGPT Enterprise, Claude Enterprise, Agentforce y ServiceNow aparecen en el catálogo con los parámetros que pedirán. El catálogo vive en `apps/web/src/lib/connectors/integrations.ts`.

## Pruebas
`apps/web/tests/connectors.test.ts` simula Graph y Power Platform (paginación, permisos, falla parcial) y valida cifrado, estado OAuth y la política de AWS.
