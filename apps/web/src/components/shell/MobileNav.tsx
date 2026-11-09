'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { AppRole } from '@/lib/demo-users';
import { AppNav } from './AppNav';
import { SignOutButton } from './SignOutButton';
import { ThemeToggle } from './ThemeToggle';

/** Menú lateral para pantallas chicas: mismas secciones que la barra lateral de escritorio. */
export function MobileNav({ role, orgName, userName, email }: { role: AppRole; orgName: string; userName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink transition hover:bg-canvas-subtle md:hidden"
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} />
      </button>
      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[60] md:hidden">
              <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
              <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col border-r border-border bg-canvas-elevated shadow-xl">
                <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink font-display text-[13px] font-semibold text-canvas">Ó</span>
                    <div className="min-w-0 leading-tight">
                      <p className="text-[14px] font-semibold tracking-tight text-ink">Ónix Govern</p>
                      <p className="truncate text-[11px] text-ink-subtle">{orgName}</p>
                    </div>
                  </div>
                  <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas-subtle">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <AppNav role={role} />
                </div>
                <div className="flex items-end justify-between gap-3 border-t border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-ink">{userName}</p>
                    <p className="truncate text-[11px] text-ink-subtle">{email}</p>
                    <div className="mt-2">
                      <SignOutButton />
                    </div>
                  </div>
                  <ThemeToggle />
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
