'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button type="button" className="text-[12px] text-ink-subtle transition hover:text-ink" onClick={() => signOut({ callbackUrl: '/login' })}>
      Cerrar sesión
    </button>
  );
}
