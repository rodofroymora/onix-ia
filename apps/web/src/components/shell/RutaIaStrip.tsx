'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STEPS = [
  { href: '/evaluacion', label: 'Evaluación' },
  { href: '/inventario', label: 'Inventario' },
  { href: '/priorizacion', label: 'Priorización' },
  { href: '/plan', label: 'Plan' },
] as const;

export function RutaIaStrip() {
  const pathname = usePathname();
  const activeIdx = STEPS.findIndex((s) => pathname.startsWith(s.href));

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface/80 px-2 py-1.5 text-xs">
      <span className="mr-2 shrink-0 font-medium text-ink-subtle">Ruta IA</span>
      {STEPS.map((step, i) => {
        const active = i === activeIdx;
        const done = activeIdx > i;
        return (
          <div key={step.href} className="flex items-center gap-1">
            {i > 0 ? <span className="text-ink-subtle">→</span> : null}
            <Link
              href={step.href}
              className={`rounded px-2 py-1 ${
                active
                  ? 'bg-accent-muted text-ink'
                  : done
                    ? 'text-ink'
                    : 'text-ink-muted hover:text-ink'
              }`}
            >
              {step.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
