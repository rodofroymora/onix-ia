export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  stub: boolean;
}

export interface LLMProvider {
  readonly id: string;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}

export interface AgentFeatureFlags {
  /** Habilita llamadas reales a LLM (por defecto false). */
  llmEnabled: boolean;
  /** Habilita redacción asistida de planes. */
  planAssist: boolean;
  /** Habilita sugerencias de evidencia. */
  evidenceAssist: boolean;
}

export const DEFAULT_FEATURE_FLAGS: AgentFeatureFlags = {
  llmEnabled: false,
  planAssist: false,
  evidenceAssist: false,
};
