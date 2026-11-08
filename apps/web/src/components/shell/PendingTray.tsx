'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';

export interface PendingItem {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export function PendingTray({ items }: { items: PendingItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-ink-muted transition hover:text-ink"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Pendientes: ${items.length}`}
      >
        <Inbox className="h-4 w-4" strokeWidth={1.6} />
        {items.length ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium text-canvas">
            {items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-md">
          <p className="border-b border-border px-4 py-2.5 text-[13px] font-medium text-ink">Pendientes</p>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={i.href} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-canvas-subtle">
                  <p className="text-[13px] text-ink">{i.label}</p>
                  <p className="text-[11px] text-ink-subtle">{i.detail}</p>
                </Link>
              </li>
            ))}
            {items.length === 0 ? <li className="px-4 py-5 text-center text-[13px] text-ink-subtle">Todo al día</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
