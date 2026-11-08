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
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {items
        .filter((i) => !i.hidden)
        .map((item) => {
          const active = current === item.id;
          return (
            <Link
              key={item.id}
              href={`${basePath}?tab=${item.id}`}
              className={`onix-tab ${active ? 'onix-tab-active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
    </div>
  );
}
