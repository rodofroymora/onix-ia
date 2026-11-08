'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/demo-users';

const NAV: { href: string; label: string; roles?: AppRole[] }[] = [
  { href: '/', label: 'Inicio' },
  { href: '/evaluacion', label: 'Evaluación' },
  { href: '/inventario', label: 'Inventario' },
  { href: '/priorizacion', label: 'Priorización' },
  { href: '/plan', label: 'Plan' },
  { href: '/reportes', label: 'Reportes' },
  { href: '/organizacion', label: 'Organización' },
  { href: '/organizaciones', label: 'Organizaciones', roles: ['consultant'] },
  { href: '/administracion', label: 'Administración', roles: ['consultant'] },
];

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm transition ${
              active ? 'bg-accent-muted text-ink' : 'text-ink-muted hover:bg-canvas-subtle hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
