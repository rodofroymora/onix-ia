import { SECTOR_TEMPLATES } from '@onix/templates';
import { createOrganizationAction } from '@/lib/actions/organizations';
import { loadAllOrganizations } from '@/lib/server/org-data';
import { requireConsultant } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function OrganizacionesPage() {
  await requireConsultant();
  const orgs = await loadAllOrganizations();

  return (
    <div>
      <PageHeader
        title="Organizaciones"
        description="Solo consultores. Alta con plantilla sectorial y mapa de responsabilidades (CU-01)."
      />

      <form action={createOrganizationAction} className="onix-panel mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto]">
        <input className="onix-input" name="name" required placeholder="Nombre de la organización" />
        <select className="onix-input" name="sector" defaultValue="hospitalidad">
          {SECTOR_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit" className="onix-btn-primary">
          Crear
        </button>
      </form>

      <ul className="divide-y divide-border onix-panel">
        {orgs.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="text-ink">{o.name}</p>
              <p className="text-xs text-ink-subtle">
                {o.sector ?? 'sin sector'} · {o.country}
              </p>
            </div>
            <span className="font-mono text-[11px] text-ink-subtle">{o.slug}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
