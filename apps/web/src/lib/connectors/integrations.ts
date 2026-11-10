/**
 * Catálogo de integraciones de Agent Discovery. Cada una declara qué descubre, qué permisos pide
 * y qué parámetros necesita; la pantalla de Conexiones arma su formulario a partir de aquí.
 */

export type ParamField =
  | { k: string; type: 'text'; label: string; placeholder?: string; help?: string; optional?: boolean }
  | { k: string; type: 'secret'; label: string; placeholder?: string; help?: string }
  | { k: string; type: 'multi'; label: string; options: { k: string; n: string; d?: string }[]; help?: string }
  | { k: string; type: 'oauth'; label: string; help?: string };

export interface Integration {
  key: string;
  /** Conector que la implementa (tabla connectors.provider). */
  provider: 'microsoft' | 'aws' | 'google' | 'openai' | 'anthropic' | 'salesforce' | 'servicenow';
  name: string;
  vendor: string;
  initials: string;
  category: 'Productividad' | 'Plataformas de agentes' | 'Asistentes de IA';
  availability: 'disponible' | 'pronto';
  summary: string;
  discovers: string[];
  permissions: string[];
  requirements: string[];
  params: ParamField[];
}

export const MS_SOURCES = [
  { k: 'entra', n: 'Apps de IA en Entra ID', d: 'Apps de terceros autorizadas con cuentas de la empresa' },
  { k: 'powerplatform', n: 'Agentes de Copilot Studio', d: 'Inventario de Power Platform y Agent Builder' },
];

export const INTEGRATIONS: Integration[] = [
  {
    key: 'microsoft',
    provider: 'microsoft',
    name: 'Microsoft 365 y Entra ID',
    vendor: 'Microsoft',
    initials: 'M',
    category: 'Productividad',
    availability: 'disponible',
    summary: 'Encuentra las apps de IA que la gente autorizó con su cuenta de trabajo y los agentes creados en Copilot Studio.',
    discovers: [
      'Apps de IA de terceros (ChatGPT, Claude, Otter, Fireflies y más) con cuántas personas las autorizaron',
      'Qué puede hacer cada app: leer o enviar correo, calendario, archivos, chats',
      'Agentes de Copilot Studio y del Agent Builder de M365, con su creador',
    ],
    permissions: ['Leer aplicaciones del directorio', 'Leer autorizaciones dadas a las apps', 'Consultar el inventario de Power Platform'],
    requirements: [
      'Una cuenta con rol Global Reader o Cloud Application Administrator',
      'Para los agentes: rol AI Reader o Power Platform Administrator',
      'Consentir en nombre de la organización al iniciar sesión',
    ],
    params: [
      { k: 'sources', type: 'multi', label: 'Qué quieres revisar', options: MS_SOURCES },
      { k: 'domain', type: 'text', label: 'Dominio de tu empresa', placeholder: 'tuempresa.com', help: 'Opcional. Lleva directo al inicio de sesión de tu organización.', optional: true },
      { k: 'signin', type: 'oauth', label: 'Iniciar sesión con Microsoft', help: 'Ónix nunca ve tu contraseña; Microsoft le da un permiso de solo lectura que puedes retirar cuando quieras.' },
    ],
  },
  {
    key: 'aws',
    provider: 'aws',
    name: 'Amazon Bedrock',
    vendor: 'AWS',
    initials: 'A',
    category: 'Plataformas de agentes',
    availability: 'disponible',
    summary: 'Lista los agentes de Amazon Bedrock y de Bedrock AgentCore en las regiones que elijas.',
    discovers: ['Agentes de Amazon Bedrock con su estado', 'Agentes desplegados en Bedrock AgentCore', 'Región y cuenta de cada agente'],
    permissions: ['bedrock:ListAgents y GetAgent', 'bedrock-agentcore:ListAgentRuntimes y GetAgentRuntime'],
    requirements: ['Crear en IAM un rol para "Otra cuenta de AWS" con la política que te damos', 'El rol solo tiene permisos de lectura'],
    params: [
      { k: 'roleArn', type: 'text', label: 'ARN del rol', placeholder: 'arn:aws:iam::123456789012:role/OnixGovernDiscovery' },
      { k: 'regions', type: 'multi', label: 'Regiones', options: [] },
    ],
  },
  {
    key: 'google',
    provider: 'google',
    name: 'Gemini Enterprise',
    vendor: 'Google',
    initials: 'G',
    category: 'Productividad',
    availability: 'pronto',
    summary: 'Agentes de Gemini Enterprise y apps de IA autorizadas en Google Workspace.',
    discovers: ['Agentes de Gemini Enterprise y del Agent Designer', 'Apps de terceros con acceso OAuth a Workspace'],
    permissions: ['Lectura de agentes de Gemini Enterprise', 'Reportes de tokens OAuth de Workspace'],
    requirements: ['Una cuenta de servicio con delegación en el dominio', 'Rol de lectura en el proyecto de Google Cloud'],
    params: [
      { k: 'projectId', type: 'text', label: 'Id. del proyecto de Google Cloud', placeholder: 'mi-proyecto-123' },
      { k: 'location', type: 'text', label: 'Ubicación', placeholder: 'global' },
      { k: 'adminEmail', type: 'text', label: 'Correo de un administrador de Workspace', placeholder: 'admin@tuempresa.com' },
      { k: 'serviceAccount', type: 'secret', label: 'Llave de la cuenta de servicio (JSON)' },
    ],
  },
  {
    key: 'openai',
    provider: 'openai',
    name: 'ChatGPT Enterprise',
    vendor: 'OpenAI',
    initials: 'O',
    category: 'Asistentes de IA',
    availability: 'pronto',
    summary: 'GPTs personalizados y uso por persona en el espacio de ChatGPT Enterprise.',
    discovers: ['GPTs creados en el espacio de trabajo y quién los creó', 'Usuarios activos y conectores habilitados'],
    permissions: ['Compliance API de solo lectura'],
    requirements: ['Plan ChatGPT Enterprise', 'Llave de la Compliance API generada por el dueño del espacio'],
    params: [
      { k: 'workspaceId', type: 'text', label: 'Id. del espacio de trabajo', placeholder: 'ws-…' },
      { k: 'apiKey', type: 'secret', label: 'Llave de la Compliance API' },
    ],
  },
  {
    key: 'anthropic',
    provider: 'anthropic',
    name: 'Claude Enterprise',
    vendor: 'Anthropic',
    initials: 'C',
    category: 'Asistentes de IA',
    availability: 'pronto',
    summary: 'Proyectos, conectores y uso por persona en la organización de Claude.',
    discovers: ['Proyectos compartidos y sus conectores', 'Usuarios activos por área'],
    permissions: ['Lectura de la organización'],
    requirements: ['Plan Claude Enterprise o Team', 'Llave de administración de la organización'],
    params: [
      { k: 'orgId', type: 'text', label: 'Id. de la organización', placeholder: 'org-…' },
      { k: 'adminKey', type: 'secret', label: 'Llave de administración' },
    ],
  },
  {
    key: 'salesforce',
    provider: 'salesforce',
    name: 'Agentforce',
    vendor: 'Salesforce',
    initials: 'S',
    category: 'Plataformas de agentes',
    availability: 'pronto',
    summary: 'Agentes de Agentforce, sus temas y acciones.',
    discovers: ['Agentes de Agentforce activos', 'Canales donde atienden', 'Acciones que pueden ejecutar'],
    permissions: ['Lectura de metadatos de agentes'],
    requirements: ['Una app conectada con OAuth en tu organización de Salesforce'],
    params: [
      { k: 'instanceUrl', type: 'text', label: 'URL de tu organización', placeholder: 'https://tuempresa.my.salesforce.com' },
      { k: 'signin', type: 'oauth', label: 'Iniciar sesión con Salesforce' },
    ],
  },
  {
    key: 'servicenow',
    provider: 'servicenow',
    name: 'ServiceNow AI Agents',
    vendor: 'ServiceNow',
    initials: 'N',
    category: 'Plataformas de agentes',
    availability: 'pronto',
    summary: 'Agentes de IA de ServiceNow y los flujos que orquestan.',
    discovers: ['Agentes y equipos de agentes', 'Flujos y herramientas que usan'],
    permissions: ['Lectura de tablas de AI Agents'],
    requirements: ['Usuario de integración con rol de solo lectura'],
    params: [
      { k: 'instance', type: 'text', label: 'Instancia', placeholder: 'tuempresa.service-now.com' },
      { k: 'user', type: 'text', label: 'Usuario de integración' },
      { k: 'password', type: 'secret', label: 'Contraseña del usuario de integración' },
    ],
  },
];

export const integrationByKey = (k?: string | null) => INTEGRATIONS.find((i) => i.key === k) ?? null;
