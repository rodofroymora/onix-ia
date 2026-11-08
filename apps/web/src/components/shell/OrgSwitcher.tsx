'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building2 } from 'lucide-react';

export function OrgSwitcher({
  orgs,
}: {
  orgs: { id: string; name: string }[];
}) {
  const { data, update } = useSession();
  const router = useRouter();
  if (!data?.user || data.user.role !== 'consultant') return null;

  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted">
      <Building2 className="h-3.5 w-3.5" />
      <select
        className="onix-input max-w-[220px] py-1.5 text-xs"
        value={data.user.organizationId}
        onChange={async (e) => {
          const id = e.target.value;
          const org = orgs.find((o) => o.id === id);
          await update({ organizationId: id, organizationName: org?.name ?? '' });
          router.refresh();
        }}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
