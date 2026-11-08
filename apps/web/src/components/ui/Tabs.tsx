'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function Tabs({
  basePath,
  items,
}: {
  basePath: string;
  items: { id: string; label: string; hidden?: boolean }[];
}) {
  const search = useSearchParams();
  const current = search.get('tab') ?? items.find((i) => !i.hidden)?.id;

  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-surface p-1">
      {items
        .filter((i) => !i.hidden)
        .map((item) => {
          const active = current === item.id;
          return (
            <Link
              key={item.id}
              href={`${basePath}?tab=${item.id}`}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${
                active
                  ? 'bg-[color-mix(in_srgb,var(--onix-accent)_14%,transparent)] font-medium text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--onix-accent)_28%,transparent)]'
                  : 'text-ink-muted hover:bg-canvas-subtle hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
    </div>
  );
}
