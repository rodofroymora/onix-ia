'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button type="button" className="onix-btn-ghost text-xs" onClick={() => signOut({ callbackUrl: '/login' })}>
      Cerrar sesión
    </button>
  );
}
