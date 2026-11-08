import {
  DEFAULT_FEATURE_FLAGS,
  type AgentFeatureFlags,
  type LLMCompletionRequest,
  type LLMCompletionResponse,
  type LLMProvider,
} from './types.js';
import { StubLLMProvider } from './stub-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';

export type {
  LLMMessage,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProvider,
  AgentFeatureFlags,
} from './types.js';
export { DEFAULT_FEATURE_FLAGS } from './types.js';
export { StubLLMProvider } from './stub-provider.js';
export { AnthropicProvider, AnthropicError } from './anthropic-provider.js';

/** Proveedor según entorno: Anthropic si hay ANTHROPIC_API_KEY, si no, null (el llamador usa su modo sin LLM). */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): LLMProvider | null {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new AnthropicProvider(key, env.ONIX_LLM_MODEL?.trim() || undefined);
}

export function createProvider(flags: AgentFeatureFlags = DEFAULT_FEATURE_FLAGS): LLMProvider {
  // Feature-flagged: cuando llmEnabled sea true se cableará un proveedor real.
  if (!flags.llmEnabled) {
    return new StubLLMProvider();
  }
  // Placeholder: aún sin proveedor real en v1 scaffold.
  return new StubLLMProvider();
}

export async function assistPlanDraft(
  flags: AgentFeatureFlags,
  req: LLMCompletionRequest,
): Promise<LLMCompletionResponse | null> {
  if (!flags.planAssist) return null;
  const provider = createProvider(flags);
  return provider.complete(req);
}

export async function assistEvidenceHints(
  flags: AgentFeatureFlags,
  req: LLMCompletionRequest,
): Promise<LLMCompletionResponse | null> {
  if (!flags.evidenceAssist) return null;
  const provider = createProvider(flags);
  return provider.complete(req);
}
