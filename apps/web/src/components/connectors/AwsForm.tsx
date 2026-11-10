'use client';

import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { saveAwsAction } from '@/lib/actions/connectors';

export function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
          className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
        >
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-border bg-canvas-subtle px-3 py-2 text-[11px] leading-relaxed text-ink-muted">{text}</pre>
    </div>
  );
}

export function AwsForm({ regions, selected, roleArn }: { regions: string[]; selected: string[]; roleArn?: string }) {
  const [state, action, pending] = useActionState(saveAwsAction, null);
  return (
    <form action={action} className="mt-3 space-y-3">
      <label className="block">
        <span className="text-[12px] text-ink-muted">ARN del rol que creaste</span>
        <input name="roleArn" defaultValue={roleArn} placeholder="arn:aws:iam::123456789012:role/OnixGovernDiscovery" className="onix-input mt-1 font-mono text-[12px]" required />
      </label>
      <fieldset>
        <legend className="text-[12px] text-ink-muted">Regiones donde tienes agentes</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {regions.map((r) => (
            <label key={r} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] has-[:checked]:border-accent has-[:checked]:bg-canvas-subtle has-[:checked]:text-accent">
              <input type="checkbox" name="regions" value={r} defaultChecked={selected.includes(r)} className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button className="onix-btn-primary" disabled={pending}>
          {pending ? 'Conectando…' : 'Conectar y buscar agentes'}
        </button>
        {state ? <span className={`text-[12px] ${state.ok ? 'text-success' : 'text-danger'}`}>{state.message}</span> : null}
      </div>
    </form>
  );
}
