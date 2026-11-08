import type { LLMCompletionRequest, LLMCompletionResponse, LLMProvider } from './types.js';

/**
 * Proveedor stub: no llama a ningún LLM.
 * Respuestas orientativas en español México; no afirma certificación.
 */
export class StubLLMProvider implements LLMProvider {
  readonly id = 'stub';

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const last = req.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    return {
      model: 'stub-v0',
      stub: true,
      content:
        'Respuesta de prueba (agente desactivado). ' +
        'Esta es una Revisión inicial orientativa y no constituye certificación. ' +
        (last ? `Recibí: «${last.slice(0, 120)}»` : 'Sin mensaje de usuario.'),
    };
  }
}
