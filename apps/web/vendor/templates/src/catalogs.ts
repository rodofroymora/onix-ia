/**
 * Listas estándar de Ónix Govern. Se usan en desplegables, validación del servidor,
 * filtros y análisis, para que todos los clientes clasifiquen igual.
 */

export interface CatalogOption {
  k: string;
  n: string;
  d?: string;
}

/** Clasificación de IA: qué tipo de sistema es. */
export const AI_TYPES: CatalogOption[] = [
  { k: 'gen_texto', n: 'IA generativa de texto', d: 'Redacta, resume o responde en lenguaje natural' },
  { k: 'gen_multimedia', n: 'IA generativa de imagen, voz o video', d: 'Crea o edita contenido multimedia' },
  { k: 'copiloto', n: 'Asistente o copiloto', d: 'Ayuda a una persona dentro de su herramienta de trabajo' },
  { k: 'agente', n: 'Agente que ejecuta acciones', d: 'Usa herramientas o sistemas para completar tareas' },
  { k: 'predictivo', n: 'Modelo predictivo', d: 'Pronostica demanda, ventas, riesgo u otra cifra' },
  { k: 'clasificacion', n: 'Clasificación o detección', d: 'Etiqueta casos, detecta fraude o anomalías' },
  { k: 'vision', n: 'Visión por computadora', d: 'Analiza imágenes o video' },
  { k: 'recomendacion', n: 'Recomendación', d: 'Sugiere productos, contenidos o acciones' },
  { k: 'automatizacion', n: 'Automatización con IA', d: 'Flujo automático con un paso de IA (documentos, correos)' },
  { k: 'otro', n: 'Otro' },
];

/** Tipo de valor que genera el caso. */
export const VALUE_TYPES: CatalogOption[] = [
  { k: 'ingresos', n: 'Aumento de ingresos' },
  { k: 'costos', n: 'Reducción de costos' },
  { k: 'productividad', n: 'Productividad del equipo' },
  { k: 'experiencia', n: 'Experiencia del cliente' },
  { k: 'calidad', n: 'Calidad y precisión' },
  { k: 'riesgo', n: 'Gestión de riesgo y cumplimiento' },
  { k: 'innovacion', n: 'Nuevos productos o servicios' },
];

/** Objetivo estratégico al que se alinea. */
export const STRATEGIC_OBJECTIVES: CatalogOption[] = [
  { k: 'crecer', n: 'Crecer ventas' },
  { k: 'eficiencia', n: 'Eficiencia operativa' },
  { k: 'cliente', n: 'Mejorar la experiencia del cliente' },
  { k: 'cumplimiento', n: 'Cumplimiento regulatorio' },
  { k: 'innovacion', n: 'Innovación de producto' },
  { k: 'talento', n: 'Talento y cultura' },
  { k: 'datos', n: 'Decisiones con datos' },
];

/** Clasificación de los datos que usa. */
export const DATA_CLASSES: CatalogOption[] = [
  { k: 'publica', n: 'Pública' },
  { k: 'interna', n: 'Interna' },
  { k: 'confidencial', n: 'Confidencial del negocio' },
  { k: 'personales', n: 'Datos personales' },
  { k: 'sensibles', n: 'Datos personales sensibles', d: 'Salud, finanzas personales, biometría u origen' },
];

/** Cómo está desplegado. */
export const DEPLOYMENTS: CatalogOption[] = [
  { k: 'saas', n: 'Software de terceros (SaaS)' },
  { k: 'api', n: 'API de un modelo en la nube' },
  { k: 'cloud_propia', n: 'Nube propia (Azure, AWS, Google)' },
  { k: 'on_premise', n: 'Servidores propios' },
  { k: 'embebida', n: 'Función dentro de otro software' },
];

/** Quién lo usa. */
export const USER_SCOPES: CatalogOption[] = [
  { k: 'area', n: 'Un área interna' },
  { k: 'empresa', n: 'Toda la empresa' },
  { k: 'clientes', n: 'Clientes' },
  { k: 'socios', n: 'Proveedores o socios' },
  { k: 'publico', n: 'Público en general' },
];

/** Áreas de negocio. */
export const BUSINESS_AREAS: string[] = [
  'Atención a clientes',
  'Marketing y contenido',
  'Ventas',
  'Finanzas y crédito',
  'Operación interna',
  'Personal y reclutamiento',
  'Tecnología',
  'Jurídico y cumplimiento',
  'Dirección',
  'Otra área',
];

/** Plataformas donde viven los agentes (para Agent Discovery y telemetría). */
export const AGENT_PLATFORMS: CatalogOption[] = [
  { k: 'copilot_studio', n: 'Copilot Studio', d: 'Microsoft' },
  { k: 'agent_builder', n: 'Agent Builder de M365', d: 'Microsoft' },
  { k: 'azure_foundry', n: 'Azure AI Foundry', d: 'Microsoft' },
  { k: 'vertex', n: 'Vertex AI', d: 'Google' },
  { k: 'gemini_ent', n: 'Gemini Enterprise', d: 'Google' },
  { k: 'bedrock', n: 'Amazon Bedrock', d: 'AWS' },
  { k: 'openai', n: 'ChatGPT y GPTs', d: 'OpenAI' },
  { k: 'claude', n: 'Claude', d: 'Anthropic' },
  { k: 'salesforce', n: 'Agentforce', d: 'Salesforce' },
  { k: 'servicenow', n: 'ServiceNow AI Agents', d: 'ServiceNow' },
  { k: 'n8n', n: 'n8n', d: 'Automatización' },
  { k: 'make', n: 'Make y Zapier', d: 'Automatización' },
  { k: 'custom', n: 'Desarrollo propio', d: 'Código' },
];

export const AGENT_CHANNELS: string[] = ['Teams', 'Web', 'WhatsApp', 'Correo', 'API', 'Interno'];
export const AGENT_PUBLISHERS: string[] = ['Microsoft', 'Organización', 'Terceros'];
export const AGENT_STATUSES: string[] = ['Activo', 'Piloto', 'Inactivo', 'Bloqueado'];

/** Herramientas y modelos sugeridos (el campo admite otros). */
export const TOOL_SUGGESTIONS: string[] = [
  'Microsoft 365 Copilot',
  'Copilot Studio',
  'Azure OpenAI',
  'Azure AI Foundry',
  'Power Automate',
  'Gemini para Workspace',
  'Vertex AI',
  'Amazon Bedrock',
  'Amazon Q',
  'ChatGPT Team',
  'ChatGPT Enterprise',
  'Claude',
  'Perplexity',
  'Salesforce Agentforce',
  'HubSpot AI',
  'Zendesk AI',
  'ServiceNow',
  'Databricks',
  'Snowflake Cortex',
  'GitHub Copilot',
  'n8n',
  'Make',
  'Zapier',
];

export const VENDOR_SUGGESTIONS: string[] = [
  'Microsoft',
  'Google',
  'AWS',
  'OpenAI',
  'Anthropic',
  'Salesforce',
  'ServiceNow',
  'HubSpot',
  'Zendesk',
  'Databricks',
  'Snowflake',
  'Desarrollo propio',
];

/** Descripción corta de cada dimensión para el cuestionario. */
export const DIMENSION_INTROS: Record<string, string> = {
  est: 'Para qué usa la empresa la IA, qué valor espera y cómo decide en qué invertir.',
  rol: 'Quién decide, quién aprueba y quién responde cuando algo sale mal.',
  dat: 'Qué datos se usan con IA, dónde viven y qué se cuida antes de compartirlos.',
  rie: 'Cómo se detectan, revisan y controlan los riesgos de cada caso de IA.',
  seg: 'Accesos, cuentas, proveedores y protección técnica de las herramientas.',
  per: 'Capacitación, reglas de uso y cultura del equipo frente a la IA.',
};

export const catalogName = (list: CatalogOption[], k: string | null | undefined): string | null =>
  k ? list.find((o) => o.k === k)?.n ?? null : null;

export const inCatalog = (list: CatalogOption[], v: unknown): string | null => {
  const s = typeof v === 'string' ? v : '';
  return list.some((o) => o.k === s) ? s : null;
};
