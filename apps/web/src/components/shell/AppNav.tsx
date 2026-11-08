'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  Home,
  LayoutGrid,
  ListChecks,
  Settings2,
  Users,
} from 'lucide-react';
import type { AppRole } from '@/lib/demo-users';

const NAV: { href: string; label: string; icon: typeof Home; roles?: AppRole[]; section?: string }[] = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/evaluacion', label: 'Evaluación', icon: Gauge, section: 'Ruta IA' },
  { href: '/inventario', label: 'Inventario', icon: ClipboardList },
  { href: '/priorizacion', label: 'Priorización', icon: LayoutGrid },
  { href: '/plan', label: 'Plan', icon: ListChecks },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/organizacion', label: 'Organización', icon: Users, section: 'Configuración' },
  { href: '/organizaciones', label: 'Organizaciones', icon: Building2, roles: ['consultant'] },
  { href: '/administracion', label: 'Administración', icon: Settings2, roles: ['consultant'] },
];

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2 py-3">
      {NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <div key={item.href}>
            {item.section ? <p className="onix-label mb-1 mt-4 px-3">{item.section}</p> : null}
            <Link
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition ${
                active ? 'bg-canvas-subtle font-medium text-ink' : 'text-ink-muted hover:bg-canvas-subtle hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
