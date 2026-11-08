'use client';

import { useActionState } from 'react';
import { inviteUserAction, type InviteUserState } from '@/lib/actions/users';
import { CopyButton } from '@/components/ui/CopyButton';

export function InviteUserForm({ allowConsultant }: { allowConsultant: boolean }) {
  const [state, run, pending] = useActionState<InviteUserState | null, FormData>(inviteUserAction, null);
  return (
    <form action={run} className="space-y-2.5 border-t border-border pt-4">
      <p className="onix-label">Invitar a una persona</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" placeholder="Nombre" className="onix-input py-1.5" />
        <input name="email" type="email" required placeholder="correo@empresa.com" className="onix-input py-1.5" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select name="role" defaultValue="admin" className="onix-input w-auto py-1.5 text-[13px]">
          <option value="admin">Administración (puede editar)</option>
          <option value="viewer">Solo lectura</option>
          {allowConsultant ? <option value="consultor">Consultor de Ónix</option> : null}
        </select>
        <button className="onix-btn-primary py-1.5" disabled={pending}>
          {pending ? 'Invitando…' : 'Invitar'}
        </button>
      </div>
      {state ? (
        <div className={`rounded-lg px-3 py-2 text-[12px] ${state.ok ? 'onix-glass text-ink' : 'text-danger'}`}>
          <p>{state.message}</p>
          {state.ok && state.link ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-muted">{state.link}</span>
              <CopyButton text={state.link} label="Copiar enlace" />
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
