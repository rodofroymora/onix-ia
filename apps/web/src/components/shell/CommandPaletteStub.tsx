'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export function CommandPaletteStub() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="onix-btn-ghost hidden items-center gap-2 text-ink-muted sm:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
        <span className="text-xs">Cmd+K</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-6 pt-[15vh]">
          <div className="onix-panel w-full max-w-lg p-4">
            <p className="mb-2 text-sm font-medium text-ink">Búsqueda (próximamente)</p>
            <input className="onix-input" placeholder="Busca páginas, casos o acciones…" autoFocus />
            <p className="mt-3 text-xs text-ink-subtle">Stub de v1 — sin indexación aún.</p>
            <button type="button" className="onix-btn-ghost mt-4" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
