import { updateResponsibilityMapAction } from '@/lib/actions/organizations';
import { loadOrganizationPage } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function OrganizacionPage() {
  const session = await requireSession();
  const data = await loadOrganizationPage(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const map = data.maps[0];
  const roles = (map?.roles as { role: string; person: string }[]) ?? [];

  async function saveMap(formData: FormData) {
    'use server';
    if (!map) return;
    const next = roles.map((r, i) => ({
      role: String(formData.get(`role-${i}`) ?? r.role),
      person: String(formData.get(`person-${i}`) ?? r.person),
    }));
    const fd = new FormData();
    fd.set('mapId', map.id);
    fd.set('roles', JSON.stringify(next));
    await updateResponsibilityMapAction(fd);
  }

  return (
    <div>
      <PageHeader
        title="Organización"
        description={`${data.org?.name ?? ''} · Usuarios y mapa de responsabilidades.`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="onix-panel p-5">
          <h2 className="text-sm font-medium text-ink">Usuarios</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-ink">{m.name}</p>
                  <p className="text-xs text-ink-subtle">{m.email}</p>
                </div>
                <span className="text-xs text-ink-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="onix-panel p-5">
          <h2 className="text-sm font-medium text-ink">Mapa de responsabilidades</h2>
          {map && canWrite ? (
            <form action={saveMap} className="mt-3 space-y-3">
              <ul className="space-y-2">
                {roles.map((r, idx) => (
                  <li key={`${r.role}-${idx}`} className="grid grid-cols-2 gap-2">
                    <input className="onix-input" defaultValue={r.role} name={`role-${idx}`} />
                    <input className="onix-input" defaultValue={r.person} name={`person-${idx}`} />
                  </li>
                ))}
              </ul>
              <button type="submit" className="onix-btn-primary">
                Guardar mapa
              </button>
            </form>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {roles.map((r, i) => (
                <li key={i} className="flex justify-between gap-2 text-ink-muted">
                  <span>{r.role}</span>
                  <span className="text-ink">{r.person}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
