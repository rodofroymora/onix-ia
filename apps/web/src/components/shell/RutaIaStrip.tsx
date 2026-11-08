'use client';

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
  return (
    <ol className="flex items-center gap-1 overflow-x-auto text-[12px]">
      {STEPS.map((step, i) => {
        const active = pathname.startsWith(step.href);
        const isDone = done.includes(step.href);
        return (
          <li key={step.href} className="flex items-center gap-1">
            {i > 0 ? <span className="mx-1 h-px w-4 bg-border-strong" aria-hidden /> : null}
            <Link
              href={step.href}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${
                active ? 'bg-ink text-canvas' : isDone ? 'text-ink' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                  active ? 'border-canvas/40' : isDone ? 'border-ink bg-ink text-canvas' : 'border-border-strong'
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
