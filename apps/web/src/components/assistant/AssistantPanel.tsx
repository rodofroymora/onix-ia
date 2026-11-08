'use client';

import { useActionState, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Sparkles, X } from 'lucide-react';
import { askAssistantAction, type AssistantState, type AssistantTask } from '@/lib/actions/assistant';
import { AiText } from './AiText';

const TASKS: { k: AssistantTask; n: string; d: string }[] = [
  { k: 'resumen_ejecutivo', n: 'Resumen para dirección', d: 'Dónde estamos, qué cambió y qué decidir' },
  { k: 'hallazgos', n: 'Hallazgos clave', d: 'Los tres puntos que más importan' },
  { k: 'siguientes_pasos', n: 'Siguientes pasos', d: 'Qué hacer en las próximas cuatro semanas' },
];

/** Asistente Ónix global: botón en el encabezado que abre un panel a la derecha (atajo ⌘J). */
export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<AssistantState | null, FormData>(askAssistantAction, null);

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
                <p className="mt-1 text-[12px] text-ink-muted">Redacta con los datos de tu organización. Siempre es una sugerencia.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={action} className="grid gap-2 px-5">
              {TASKS.map((t) => {
                const active = state?.task === t.k;
                return (
                  <button
                    key={t.k}
                    name="task"
                    value={t.k}
                    disabled={pending}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                      active ? 'onix-glass border-transparent' : 'border-border bg-surface hover:border-border-strong'
                    }`}
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
              ) : state ? (
                <>
                  <AiText text={state.text} />
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="onix-pill">{state.source === 'llm' ? 'Redactado con IA' : 'Armado con tus datos'}</span>
                    {state.sources.map((s) => (
                      <span key={s} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                  {state.llmError ? <p className="mt-2 text-[12px] text-warning">{state.llmError}</p> : null}
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(state.text.replace(/\*\*/g, ''));
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
                <p className="text-[13px] text-ink-muted">Elige qué quieres que redacte.</p>
              )}
            </div>
          </aside>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
