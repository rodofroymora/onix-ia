/** Funciones del mapa de responsables (CU-01) y qué dimensiones contesta cada una (CU-02). */

export type FunctionKey =
  | 'direccion'
  | 'ti'
  | 'seguridad'
  | 'datos'
  | 'juridico'
  | 'riesgos'
  | 'operaciones'
  | 'rh';

export interface FunctionDef {
  k: FunctionKey;
  n: string;
  dims: ('est' | 'rol' | 'dat' | 'rie' | 'seg' | 'per')[];
}

export const FUNCTIONS: FunctionDef[] = [
  { k: 'direccion', n: 'Dirección', dims: ['est', 'rol', 'per'] },
  { k: 'ti', n: 'TI', dims: ['seg', 'dat'] },
  { k: 'seguridad', n: 'Seguridad', dims: ['seg'] },
  { k: 'datos', n: 'Datos', dims: ['dat'] },
  { k: 'juridico', n: 'Jurídico', dims: ['dat', 'rie', 'rol'] },
  { k: 'riesgos', n: 'Riesgos', dims: ['rie', 'rol'] },
  { k: 'operaciones', n: 'Operaciones', dims: ['est', 'rie', 'per'] },
  { k: 'rh', n: 'Recursos humanos', dims: ['per'] },
];

export function functionName(k: string): string {
  return FUNCTIONS.find((f) => f.k === k)?.n ?? k;
}

/** Dimensiones que le tocan a quien cubre estas funciones. */
export function dimsForFunctions(keys: string[]): string[] {
  const set = new Set<string>();
  for (const f of FUNCTIONS) if (keys.includes(f.k)) f.dims.forEach((d) => set.add(d));
  return [...set];
}

/** Ecosistemas del perfil tecnológico y herramientas sugeridas (selector por casillas). */
export interface TechEcosystem {
  k: string;
  n: string;
  tools: string[];
}

export const TECH_ECOSYSTEMS: TechEcosystem[] = [
  {
    k: 'microsoft',
    n: 'Microsoft y Azure',
    tools: ['Microsoft 365 Copilot', 'Copilot Studio', 'Azure OpenAI', 'Azure AI Foundry', 'Power Automate'],
  },
  { k: 'google', n: 'Google', tools: ['Gemini para Workspace', 'Vertex AI', 'Gemini Enterprise'] },
  { k: 'aws', n: 'AWS', tools: ['Amazon Bedrock', 'Amazon Q', 'SageMaker'] },
  { k: 'asistentes', n: 'Asistentes', tools: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity'] },
  { k: 'plataformas', n: 'Plataformas', tools: ['ServiceNow', 'Salesforce Einstein', 'HubSpot AI', 'Zendesk AI'] },
  { k: 'datos', n: 'Datos', tools: ['Databricks', 'Snowflake', 'Microsoft Fabric', 'BigQuery'] },
  { k: 'desarrollo', n: 'Desarrollo', tools: ['GitHub Copilot', 'Cursor', 'Claude Code'] },
  { k: 'automatizacion', n: 'Automatización', tools: ['n8n', 'Make', 'Zapier'] },
];

/** Anillos del radar tecnológico. "Retirar" incluye cuentas personales o gratuitas (IA en la sombra). */
export const TECH_RINGS = ['Adoptado', 'Piloto', 'Evaluando', 'Retirar'] as const;
export type TechRing = (typeof TECH_RINGS)[number];

export interface TechItem {
  tool: string;
  eco: string;
  ring: TechRing;
  license: 'empresarial' | 'personal' | 'gratuita';
}
