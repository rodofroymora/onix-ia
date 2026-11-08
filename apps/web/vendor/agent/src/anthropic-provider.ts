import type { LLMCompletionRequest, LLMCompletionResponse, LLMProvider } from './types.js';

/**
 * Proveedor Anthropic (Messages API) sin SDK. Solo se usa si hay ANTHROPIC_API_KEY.
 * Los datos se envían por API; según los términos comerciales de Anthropic no se usan para entrenar.
 */
export class AnthropicError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Anthropic respondió ${status}${detail ? ` (${detail.slice(0, 300)})` : ''}`);
  }
  /** Explicación corta para mostrar en pantalla. */
  get hint(): string {
    const d = this.detail.toLowerCase();
    if (d.includes('credit') || d.includes('balance')) return 'La cuenta de Anthropic no tiene saldo o créditos disponibles.';
    if (this.status === 401 || d.includes('api key') || d.includes('authentication')) return 'La clave ANTHROPIC_API_KEY no es válida.';
    if (this.status === 404 || d.includes('model')) return 'El modelo configurado no está disponible para esta cuenta.';
    if (this.status === 429) return 'Se alcanzó el límite de uso de la API; intenta en unos minutos.';
    return `El modelo no respondió (${this.status}).`;
  }
}

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
        // Solo se manda si se pide: algunos modelos recientes rechazan parámetros de muestreo.
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
        system: system || undefined,
        messages,
      }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const err = (await res.json()) as { error?: { type?: string; message?: string } };
        detail = [err.error?.type, err.error?.message].filter(Boolean).join(': ');
      } catch {
        /* sin cuerpo */
      }
      throw new AnthropicError(res.status, detail);
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
