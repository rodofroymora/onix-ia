'use client';

import { Bell } from 'lucide-react';
import { useState } from 'react';

export function PendingTrayStub() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="onix-btn-ghost px-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="Bandeja de pendientes"
      >
        <Bell className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-72 onix-panel p-3">
          <p className="text-sm font-medium text-ink">Pendientes</p>
          <p className="mt-2 text-xs text-ink-muted">
            Stub: aquí verás invitaciones, evidencias por revisar y validaciones.
          </p>
        </div>
      ) : null}
    </div>
  );
}
