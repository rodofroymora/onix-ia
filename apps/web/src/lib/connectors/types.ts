/** Lo que un conector reporta por cada cosa que encuentra en la nube del cliente. */
export interface DiscoveredInput {
  source: 'entra' | 'powerplatform' | 'bedrock' | 'agentcore';
  externalId: string;
  kind: 'app' | 'agente';
  name: string;
  vendor: string | null;
  platform: string;
  ownerName: string | null;
  usersCount: number | null;
  suggestedRisk: 'Bajo' | 'Medio' | 'Alto' | null;
  details: Record<string, unknown>;
}

export interface SyncResult {
  items: DiscoveredInput[];
  /** Fuentes que respondieron bien; si una falla, sus registros previos no se marcan como desaparecidos. */
  okSources: DiscoveredInput['source'][];
  warnings: string[];
}

export type Http = (url: string, init?: RequestInit) => Promise<Response>;

export class ConnectorError extends Error {
  constructor(
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}

export const PROVIDERS = {
  microsoft: { n: 'Microsoft 365 y Entra ID', d: 'Apps de IA autorizadas con cuentas de la empresa y agentes de Copilot Studio.' },
  aws: { n: 'Amazon Web Services', d: 'Agentes de Amazon Bedrock y AgentCore en las regiones que elijas.' },
  google: { n: 'Google Workspace y Gemini Enterprise', d: 'Agentes de Gemini Enterprise. Disponible pronto.' },
} as const;
export type ProviderKey = keyof typeof PROVIDERS;

export const SOURCE_LABEL: Record<DiscoveredInput['source'], string> = {
  entra: 'Entra ID',
  powerplatform: 'Copilot Studio',
  bedrock: 'Amazon Bedrock',
  agentcore: 'Bedrock AgentCore',
};
