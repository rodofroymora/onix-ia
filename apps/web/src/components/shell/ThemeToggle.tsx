'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

type Mode = 'light' | 'dark' | 'system';
const KEY = 'onix-theme';

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

/** Claro, oscuro o según el sistema; se recuerda en este navegador. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Mode | null;
      if (saved === 'light' || saved === 'dark') setMode(saved);
    } catch {
      /* sin almacenamiento: queda según el sistema */
    }
  }, []);
  const next: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' };
  const label: Record<Mode, string> = { system: 'Tema del sistema', light: 'Modo claro', dark: 'Modo oscuro' };
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        const m = next[mode];
        setMode(m);
        applyMode(m);
        try {
          if (m === 'system') localStorage.removeItem(KEY);
          else localStorage.setItem(KEY, m);
        } catch {
          /* ignorar */
        }
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted transition hover:text-ink"
      title={`${label[mode]} (clic para cambiar)`}
      aria-label={`${label[mode]}. Cambiar tema`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.6} />
    </button>
  );
}
