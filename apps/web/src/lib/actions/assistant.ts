'use server';

import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { loadOrgOverview } from '@/lib/server/insights';
import { PROMPTS, writeWithAssistant, type AssistantTask } from '@/lib/server/narrative';
import { requireSession } from '@/lib/session';

export type { AssistantTask } from '@/lib/server/narrative';

export interface AssistantState {
  text: string;
  source: 'llm' | 'datos';
  sources: string[];
  task: AssistantTask;
  llmError?: string;
}

export async function askAssistantAction(_prev: AssistantState | null, formData: FormData): Promise<AssistantState> {
  const session = await requireSession();
  const task = (String(formData.get('task') ?? 'resumen_ejecutivo') as AssistantTask) in PROMPTS
    ? (String(formData.get('task')) as AssistantTask)
    : 'resumen_ejecutivo';
  const o = await loadOrgOverview(session.user.organizationId);
  const { text, source, sources, llmError } = await writeWithAssistant(task, o, session.user.organizationName ?? '');

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, (tx) =>
    appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'assistant.suggest',
      entityType: 'assistant',
      meta: { task, source, llmError: llmError ?? null },
    }),
  );

  return { text, source, sources, task, llmError };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  source?: 'llm' | 'guia';
  link?: { href: string; label: string } | null;
}
export interface ChatState {
  messages: ChatMessage[];
  llmError?: string;
}

const HELP_SYSTEM = [
  'Eres el Asistente Ónix dentro de Ónix Govern, una plataforma de gobierno de IA para empresas medianas en México.',
  'Respondes dudas de cómo usar la herramienta y preguntas sobre los datos de la organización.',
  'Usa SOLO la guía y los datos que te doy; si no está ahí, dilo y sugiere a quién preguntar.',
  'Escribe en español de México, tratando de tú, breve (máximo 120 palabras). Puedes usar puntos con "- **Título:** texto". No uses guiones largos.',
  'No digas "diagnóstico" (di "Revisión inicial") ni "certificado". ÓNIX no es organismo certificador.',
  'Si la respuesta lleva a una pantalla, termina con una línea "Ir a: /ruta" usando una ruta de la guía.',
].join(' ');

/** Chat general: cómo usar la herramienta y preguntas sobre los datos. */
export async function chatAssistantAction(prev: ChatState | null, formData: FormData): Promise<ChatState> {
  const session = await requireSession();
  const question = String(formData.get('question') ?? '').trim().slice(0, 600);
  const path = String(formData.get('path') ?? '/').slice(0, 80);
  const history = (prev?.messages ?? []).slice(-8);
  if (!question) return prev ?? { messages: [] };

  const { matchHelp, helpAsText, HELP } = await import('@/lib/server/help');
  const { contextFrom, llmHint } = await import('@/lib/server/narrative');
  const { providerFromEnv } = await import('@onix/agent');
  const provider = providerFromEnv();
  let reply: ChatMessage | null = null;
  let llmError: string | undefined;

  if (provider) {
    try {
      const o = await loadOrgOverview(session.user.organizationId);
      const ctx = contextFrom(o);
      const res = await provider.complete({
        maxTokens: 600,
        messages: [
          { role: 'system', content: `${HELP_SYSTEM}\n\nGuía:\n${helpAsText()}\n\nDatos de ${session.user.organizationName}:\n${ctx.text}\n\nPantalla actual: ${path}` },
          ...history.map((m) => ({ role: m.role, content: m.text })),
          { role: 'user', content: question },
        ],
      });
      let text = res.content.trim();
      const go = /Ir a:\s*(\/[\w\-/?=&]*)/i.exec(text);
      text = text.replace(/\n?Ir a:\s*\/[\w\-/?=&]*\s*$/i, '').trim();
      const entry = go ? HELP.find((e) => e.href.split('?')[0] === go[1]!.split('?')[0]) : null;
      reply = { role: 'assistant', text, source: 'llm', link: go ? { href: go[1]!, label: entry?.title ?? 'Abrir' } : null };
    } catch (err) {
      console.error('[asistente-chat] fallo del modelo, uso la guía', err);
      llmError = llmHint(err);
    }
  }
  if (!reply) {
    const e = matchHelp(question);
    reply = e
      ? { role: 'assistant', text: e.answer, source: 'guia', link: { href: e.href, label: e.title } }
      : {
          role: 'assistant',
          text: 'No encontré eso en la guía. Prueba con palabras como "invitar", "registrar un caso", "priorizar", "evidencia" o "reportes".',
          source: 'guia',
          link: null,
        };
  }
  return { messages: [...history, { role: 'user', text: question }, reply], llmError };
}
