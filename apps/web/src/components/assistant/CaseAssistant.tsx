'use client';

import { useActionState, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { AiText } from './AiText';
import { assistCaseAction, type CaseAssistState, type CaseSuggestion } from '@/lib/actions/case-assistant';

/** Llena la ficha del caso a partir de lo que la persona cuenta con sus palabras. */
function apply(formId: string, s: CaseSuggestion) {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return;
  const set = (name: string, value: string | undefined) => {
    if (value === undefined) return;
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (el && 'value' in el) el.value = value;
  };
  const check = (name: string, value: boolean | undefined) => {
    if (value === undefined) return;
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (el) el.checked = value;
  };
  const nameEl = form.elements.namedItem('name') as HTMLInputElement | null;
  if (s.name && nameEl && !nameEl.value) nameEl.value = s.name;
  set('description', s.description);
  set('area', s.area);
  set('aiType', s.aiType);
  set('valueType', s.valueType);
  set('strategicObjective', s.strategicObjective);
  set('dataClassification', s.dataClassification);
  set('deployment', s.deployment);
  set('userScope', s.userScope);
  set('autonomy', s.autonomy);
  check('usesPersonalData', s.usesPersonalData);
  check('decidesOnPeople', s.decidesOnPeople);
  check('customerFacing', s.customerFacing);
}

export function CaseAssistant({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [state, action, pending] = useActionState<CaseAssistState | null, FormData>(assistCaseAction, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3.5 py-2.5 text-left text-[13px] text-ink-muted transition hover:border-border-strong hover:text-ink"
      >
        <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.6} />
        Descríbelo con tus palabras y el Asistente llena la ficha
      </button>
    );
  }

  const s = state?.suggestion;
  return (
    <div className="onix-glass rounded-xl px-4 py-3.5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.6} /> Asistente Ónix
      </p>
      <textarea
        name="raw"
        form="case-assist"
        rows={3}
        placeholder="Ej. Un bot en WhatsApp que contesta dudas de huéspedes y hace reservas; usa Azure OpenAI y los datos del PMS."
        className="onix-input mt-2 text-[13px]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-subtle">Es una sugerencia: revisa antes de guardar.</span>
        <button
          type="submit"
          form="case-assist"
          className="onix-btn-ghost py-1.5"
          disabled={pending}
          onClick={(e) => {
            // el nombre actual viaja con la petición
            const f = document.getElementById(formId) as HTMLFormElement | null;
            const n = (f?.elements.namedItem('name') as HTMLInputElement | null)?.value ?? '';
            const hidden = document.getElementById('case-assist-name') as HTMLInputElement | null;
            if (hidden) hidden.value = n;
            setApplied(false);
            void e;
          }}
        >
          {pending ? 'Pensando…' : 'Sugerir ficha'}
        </button>
      </div>
      {state?.error ? <p className="mt-2 text-[12px] text-danger">{state.error}</p> : null}
      {s ? (
        <div className="mt-3 border-t border-border pt-3">
          <AiText text={s.description} compact />
          {s.questions.length ? (
            <ul className="mt-2 space-y-0.5 text-[12px] text-ink-muted">
              {s.questions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-subtle">
              {state?.source === 'llm' ? 'Redactado con IA' : state?.llmError ? `Armado con reglas. ${state.llmError}` : 'Armado con reglas (sin modelo configurado)'}
            </span>
            <button
              type="button"
              className="onix-btn-primary py-1.5"
              onClick={() => {
                apply(formId, s);
                setApplied(true);
              }}
            >
              {applied ? 'Aplicado' : 'Aplicar a la ficha'}
            </button>
          </div>
        </div>
      ) : null}
      <AssistForm action={action} />
    </div>
  );
}

/** Formulario aparte (no se puede anidar dentro de la ficha); los campos se asocian con form="case-assist". */
function AssistForm({ action }: { action: (fd: FormData) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <form id="case-assist" action={action} className="hidden">
      <input id="case-assist-name" type="hidden" name="name" />
    </form>,
    document.body,
  );
}
