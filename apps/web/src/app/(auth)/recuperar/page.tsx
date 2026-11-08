'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { requestPasswordResetAction, type AcceptState } from '@/lib/actions/users';

export default function RecuperarPage() {
  const [state, run, pending] = useActionState<AcceptState | null, FormData>(requestPasswordResetAction, null);
  return (
    <AuthShell title="¿Olvidaste tu contraseña?" subtitle="Te mandamos un enlace para crear una nueva.">
      {state?.ok ? (
        <div className="onix-panel px-6 py-6 text-[14px] text-ink">{state.message}</div>
      ) : (
        <form action={run} className="onix-panel space-y-4 px-6 py-6">
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-ink-muted">Correo</span>
            <input name="email" type="email" required autoComplete="username" className="onix-input" />
          </label>
          {state && !state.ok ? <p className="text-[13px] text-danger">{state.message}</p> : null}
          <button className="onix-btn-primary w-full" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-[13px]">
        <Link href="/login" className="text-accent hover:underline">
          Volver a entrar
        </Link>
      </p>
    </AuthShell>
  );
}
