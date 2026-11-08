'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ArrowUp, Check, Copy, Sparkles, X } from 'lucide-react';
import { askAssistantAction, chatAssistantAction, type AssistantState, type ChatState } from '@/lib/actions/assistant';
import { tasksForPath } from '@/lib/assistant-tasks';
import { AiText } from './AiText';

const SUGGESTIONS: Record<string, string[]> = {
  '/': ['¿Por dónde empiezo?', '¿Cómo funciona la Ruta IA?', '¿Qué significa la madurez proyectada?'],
  '/evaluacion': ['¿Cómo invito a un responsable?', '¿Cuándo publico los resultados?', '¿Qué es un punto ciego?'],
  '/inventario': ['¿Cómo registro un caso?', '¿Cómo se calcula el riesgo?', '¿Puedo importar desde Excel?'],
  '/priorizacion': ['¿Cómo leo la órbita?', '¿Cómo cambio los pesos?', '¿Por qué este caso quedó arriba?'],
  '/plan': ['¿Cómo cierro una acción?', '¿Cómo agrego una dependencia?', '¿Qué está bloqueado?'],
  '/reportes': ['¿Qué informe le mando a dirección?', '¿Cómo guardo el PDF?'],
  '/agentes': ['¿Hay algo que lea contratos?', '¿Qué hago con un agente sin caso?', '¿Cómo registro un agente?'],
  '/telemetria': ['¿Cómo conecto mis sistemas?', '¿Qué es uso no autorizado?'],
  '/organizacion': ['¿Para qué sirve el mapa de responsabilidades?'],
};

/** Asistente Ónix global: funciones según la pantalla y un chat para preguntar lo que sea (⌘J). */
export function AssistantPanel() {
  const path = usePathname() || '/';
  const view = tasksForPath(path);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'vista' | 'chat'>('vista');
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<AssistantState | null, FormData>(askAssistantAction, null);
  const [chat, chatAction, chatPending] = useActionState<ChatState | null, FormData>(chatAssistantAction, null);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const suggestions = SUGGESTIONS[Object.keys(SUGGESTIONS).find((k) => (k === '/' ? path === '/' : path.startsWith(k))) ?? '/'] ?? SUGGESTIONS['/']!;
  const result = state && view.tasks.some((t) => t.k === state.task) ? state : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, chatPending]);

  const ask = (q: string) => {
    const fd = new FormData();
    fd.set('question', q);
    fd.set('path', path);
    setDraft('');
    startTransition(() => chatAction(fd));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="onix-glass inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink transition hover:brightness-105"
        title="Asistente Ónix (⌘J)"
      >
        <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.7} />
        <span className="hidden sm:inline">Asistente</span>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex justify-end">
              <button type="button" aria-label="Cerrar" className="flex-1 bg-black/20 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
              <aside className="onix-assistant-panel flex h-full w-full max-w-[440px] flex-col border-l border-border shadow-md">
                <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
                  <div>
                    <p className="inline-flex items-center gap-2 text-[16px] font-semibold text-ink">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[var(--onix-accent-contrast)]">
                        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                      Asistente Ónix
                    </p>
                    <p className="mt-1 text-[12px] text-ink-muted">Trabaja con los datos de tu organización. Siempre es una sugerencia.</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mx-5 inline-flex self-start rounded-full border border-border bg-surface p-1 text-[12.5px]">
                  {(
                    [
                      ['vista', `Para ${view.label}`],
                      ['chat', 'Pregúntame'],
                    ] as const
                  ).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-full px-3 py-1 transition ${mode === k ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}>
                      {l}
                    </button>
                  ))}
                </div>

                {mode === 'vista' ? (
                  <>
                    <form action={action} className="mt-3 grid gap-2 px-5">
                      {view.tasks.map((t) => {
                        const active = result?.task === t.k;
                        return (
                          <button
                            key={t.k}
                            name="task"
                            value={t.k}
                            disabled={pending}
                            className={`rounded-xl border px-3.5 py-2.5 text-left transition ${active ? 'onix-glass border-transparent' : 'border-border bg-surface hover:border-border-strong'}`}
                          >
                            <span className="block text-[13px] font-medium text-ink">{t.n}</span>
                            <span className="block text-[11.5px] text-ink-muted">{t.d}</span>
                          </button>
                        );
                      })}
                    </form>
                    <div className="mt-4 flex-1 overflow-y-auto border-t border-border px-5 py-4">
                      {pending ? (
                        <div className="space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="onix-glass h-14 animate-pulse rounded-xl" />
                          ))}
                          <p className="pt-1 text-[12px] text-ink-subtle">Redactando con los datos de tu organización…</p>
                        </div>
                      ) : result ? (
                        <>
                          <AiText text={result.text} />
                          <div className="mt-4 flex flex-wrap items-center gap-1.5">
                            <span className="onix-pill">{result.source === 'llm' ? 'Redactado con IA' : 'Armado con tus datos'}</span>
                            {result.sources.map((s) => (
                              <span key={s} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-muted">
                                {s}
                              </span>
                            ))}
                          </div>
                          {result.llmError ? <p className="mt-2 text-[12px] text-warning">{result.llmError}</p> : null}
                          <button
                            type="button"
                            className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(result.text.replace(/\*\*/g, ''));
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              } catch {
                                /* sin portapapeles */
                              }
                            }}
                          >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copiado' : 'Copiar texto'}
                          </button>
                        </>
                      ) : (
                        <p className="text-[13px] text-ink-muted">Elige qué quieres que haga en {view.label}.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-3 flex-1 space-y-3 overflow-y-auto border-t border-border px-5 py-4">
                      {!chat?.messages.length ? (
                        <div>
                          <p className="text-[13px] text-ink-muted">Pregúntame cómo usar Ónix Govern o algo sobre los datos de tu organización.</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {suggestions.map((q) => (
                              <button key={q} type="button" onClick={() => ask(q)} className="onix-pill cursor-pointer font-medium transition hover:brightness-110">
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {chat?.messages.map((m, i) =>
                        m.role === 'user' ? (
                          <div key={i} className="flex justify-end">
                            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13px] text-[var(--onix-accent-contrast)]">{m.text}</p>
                          </div>
                        ) : (
                          <div key={i} className="onix-glass rounded-2xl rounded-bl-md px-3.5 py-3">
                            <AiText text={m.text} compact />
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {m.link ? (
                                <Link href={m.link.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                                  {m.link.label} <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              ) : null}
                              <span className="text-[11px] text-ink-subtle">{m.source === 'llm' ? 'Con IA' : 'De la guía'}</span>
                            </div>
                          </div>
                        ),
                      )}
                      {chatPending ? <div className="onix-glass h-12 w-2/3 animate-pulse rounded-2xl" /> : null}
                      {chat?.llmError ? <p className="text-[12px] text-warning">{chat.llmError}</p> : null}
                      <div ref={endRef} />
                    </div>
                    <form
                      className="border-t border-border px-4 py-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (draft.trim()) ask(draft.trim());
                      }}
                    >
                      <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-3 py-2 focus-within:border-accent">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (draft.trim()) ask(draft.trim());
                            }
                          }}
                          rows={1}
                          placeholder="Escribe tu pregunta…"
                          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-subtle"
                        />
                        <button type="submit" disabled={chatPending || !draft.trim()} aria-label="Enviar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[var(--onix-accent-contrast)] disabled:opacity-40">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
