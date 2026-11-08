'use client';

import { useActionState } from 'react';
import type { AcceptState } from '@/lib/actions/users';

/** Formulario de contraseña nueva (invitación o recuperación). */
export function PasswordForm({
  action,
  token,
  withName,
  defaultName,
  submitLabel,
}: {
  action: (prev: AcceptState | null, fd: FormData) => Promise<AcceptState>;
  token: string;
  withName?: boolean;
  defaultName?: string;
  submitLabel: string;
}) {
  const [state, run, pending] = useActionState<AcceptState | null, FormData>(action, null);
  return (
    <form action={run} className="onix-panel space-y-4 px-6 py-6">
      <input type="hidden" name="token" value={token} />
      {withName ? (
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-ink-muted">Tu nombre</span>
          <input name="name" required defaultValue={defaultName} autoComplete="name" className="onix-input" />
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-ink-muted">Contraseña</span>
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="onix-input" />
        <span className="mt-1 block text-[11px] text-ink-subtle">Al menos 10 caracteres, con letras y números.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-ink-muted">Repite la contraseña</span>
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="onix-input" />
      </label>
      {state && !state.ok ? <p className="text-[13px] text-danger">{state.message}</p> : null}
      <button className="onix-btn-primary w-full" disabled={pending}>
        {pending ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
