'use client';

import { useActionState } from 'react';
import { Sparkle } from 'lucide-react';
import { askAssistantAction, type AssistantState, type AssistantTask } from '@/lib/actions/assistant';

const TASKS: { k: AssistantTask; n: string }[] = [
  { k: 'resumen_ejecutivo', n: 'Resumen para dirección' },
  { k: 'hallazgos', n: 'Hallazgos clave' },
  { k: 'siguientes_pasos', n: 'Siguientes pasos' },
];

export function AssistantCard({ defaultTask = 'resumen_ejecutivo' }: { defaultTask?: AssistantTask }) {
  const [state, action, pending] = useActionState<AssistantState | null, FormData>(askAssistantAction, null);
  return (
    <section className="onix-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="onix-card-title inline-flex items-center gap-1.5">
          <Sparkle className="h-3.5 w-3.5" strokeWidth={1.6} /> Asistente Ónix
        </h2>
        {state ? <span className="onix-chip">Sugerencia</span> : null}
      </div>
      <form action={action} className="mt-3 flex flex-wrap gap-1.5">
        {TASKS.map((t) => (
          <button
            key={t.k}
            name="task"
            value={t.k}
            disabled={pending}
            className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
              (state?.task ?? defaultTask) === t.k ? 'border-ink text-ink' : 'border-border text-ink-muted hover:text-ink'
            }`}
          >
            {t.n}
          </button>
        ))}
      </form>
      <div className="mt-4 min-h-[72px] text-[13px] leading-relaxed text-ink">
        {pending ? (
          <p className="text-ink-subtle">Redactando con los datos de tu organización…</p>
        ) : state ? (
          <>
            <p className="whitespace-pre-line">{state.text}</p>
            <p className="mt-3 text-[11px] text-ink-subtle">
              {state.source === 'llm' ? 'Redactado con IA' : 'Borrador armado con tus datos'} · Fuentes: {state.sources.join(', ')}. Revísalo antes de usarlo.
            </p>
          </>
        ) : (
          <p className="text-ink-subtle">Elige qué quieres que redacte. Siempre es una sugerencia: tú decides qué se queda.</p>
        )}
      </div>
    </section>
  );
}
