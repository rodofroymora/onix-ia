'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react';

const STEPS = [
  { href: '/evaluacion', label: 'Evaluación' },
  { href: '/inventario', label: 'Inventario' },
  { href: '/priorizacion', label: 'Priorización' },
  { href: '/plan', label: 'Plan' },
] as const;

/** Barra de avance de la Ruta IA. `done` marca los pasos completos según los datos. */
export function RutaIaStrip({ done = [] }: { done?: string[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = ref.current;
    const active = ol?.querySelector<HTMLElement>('[data-active="1"]');
    if (ol && active) ol.scrollLeft = active.offsetLeft - (ol.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <ol ref={ref} className="onix-scroll-x relative flex items-center gap-1 text-[12px]">
      {STEPS.map((step, i) => {
        const active = pathname.startsWith(step.href);
        const isDone = done.includes(step.href);
        return (
          <li key={step.href} className="flex shrink-0 items-center gap-1">
            {i > 0 ? <span className="mx-0.5 h-px w-3 bg-border-strong sm:mx-1 sm:w-4" aria-hidden /> : null}
            <Link
              href={step.href}
              data-active={active ? '1' : undefined}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 transition ${
                active ? 'onix-seg-active' : isDone ? 'text-ink' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                  active ? 'border-accent/50' : isDone ? 'border-ink bg-ink text-canvas' : 'border-border-strong'
                }`}
              >
                {isDone && !active ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
              </span>
              {step.label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
