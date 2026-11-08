import type { LLMCompletionRequest, LLMCompletionResponse, LLMProvider } from './types.js';

/**
 * Proveedor Anthropic (Messages API) sin SDK. Solo se usa si hay ANTHROPIC_API_KEY.
 * Los datos se envían por API; según los términos comerciales de Anthropic no se usan para entrenar.
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'claude-sonnet-5-5',
  ) {}

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? 900,
        temperature: req.temperature ?? 0.3,
        system: system || undefined,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic respondió ${res.status}`);
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[]; model?: string };
    const content = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim();
    return { content, model: json.model ?? this.model, stub: false };
  }
}
