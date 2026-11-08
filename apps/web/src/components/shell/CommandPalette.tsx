'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export interface PaletteItem {
  id: string;
  label: string;
  group: 'Ir a' | 'Casos de IA' | 'Acciones del plan' | 'Agentes';
  href: string;
  hint?: string;
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    const nq = normalize(q.trim());
    const list = nq ? items.filter((i) => normalize(`${i.label} ${i.hint ?? ''}`).includes(nq)) : items.filter((i) => i.group === 'Ir a');
    return list.slice(0, 12);
  }, [q, items]);

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        className="hidden items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-ink-subtle transition hover:text-ink sm:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
      >
        <Search className="h-3.5 w-3.5" />
        Buscar
        <kbd className="rounded border border-border px-1 font-sans text-[10px]">⌘K</kbd>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 p-4 pt-[14vh] backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-md">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-ink-subtle" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIdx((i) => Math.min(results.length - 1, i + 1));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIdx((i) => Math.max(0, i - 1));
                  }
                  if (e.key === 'Enter') go(results[idx]);
                }}
                className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle"
                placeholder="Busca pantallas, casos de IA o acciones"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13px] ${
                      i === idx ? 'bg-canvas-subtle text-ink' : 'text-ink-muted'
                    }`}
                  >
                    <span className="truncate">{r.label}</span>
                    <span className="shrink-0 text-[11px] text-ink-subtle">{r.hint ?? r.group}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 ? <li className="px-3 py-6 text-center text-[13px] text-ink-subtle">Sin resultados</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
