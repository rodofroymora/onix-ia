import { FUNCTIONS } from '@onix/templates';
import { Card, PageHeader } from '@/components/ui/PageHeader';
import { updateResponsibilityMapAction } from '@/lib/actions/organizations';
import { loadOrganizationPage } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administración',
  viewer: 'Solo lectura',
  consultant: 'Consultor',
};

type Role = { fn?: string; role: string; person: string; email?: string };

export default async function OrganizacionPage() {
  const session = await requireSession();
  const data = await loadOrganizationPage(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const roles = ((data.maps[0]?.roles as Role[] | undefined) ?? []).filter(Boolean);
  const find = (k: string, n: string) => roles.find((r) => r.fn === k || r.role === n);
  const covered = FUNCTIONS.filter((f) => {
    const p = find(f.k, f.n)?.person;
    return p && !/pendiente/i.test(p);
  }).length;

  return (
    <div>
      <PageHeader
        eyebrow="Configuración"
        title="Organización"
        description={`${data.org?.name ?? ''}. Quién usa la plataforma y quién responde por cada función frente a la IA.`}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Mapa de responsabilidades" aside={<span className="onix-chip">{covered} de {FUNCTIONS.length} funciones cubiertas</span>}>
          <form action={updateResponsibilityMapAction}>
            <fieldset disabled={!canWrite}>
              <table className="onix-table">
                <thead>
                  <tr>
                    <th>Función</th>
                    <th>Responsable</th>
                    <th className="hidden sm:table-cell">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNCTIONS.map((f) => {
                    const r = find(f.k, f.n);
                    const person = r?.person && !/pendiente/i.test(r.person) ? r.person : '';
                    return (
                      <tr key={f.k}>
                        <td className="whitespace-nowrap">
                          {f.n}
                          {!person ? <span className="ml-2 text-[11px] text-ink-subtle">sin responsable</span> : null}
                        </td>
                        <td>
                          <input name={`person:${f.k}`} defaultValue={person} placeholder="Nombre" className="onix-input py-1.5" />
                        </td>
                        <td className="hidden sm:table-cell">
                          <input name={`email:${f.k}`} type="email" defaultValue={r?.email ?? ''} placeholder="correo@empresa.com" className="onix-input py-1.5" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </fieldset>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-ink-subtle">Cada función contesta las preguntas de sus dimensiones en la evaluación.</p>
              {canWrite ? <button className="onix-btn-primary">Guardar mapa</button> : null}
            </div>
          </form>
        </Card>

        <Card title="Personas con acceso">
          <ul className="-my-1 divide-y divide-border">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas-subtle text-[12px] font-medium text-ink-muted">
                    {(m.name ?? m.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">{m.name}</p>
                    <p className="truncate text-[12px] text-ink-subtle">{m.email}</p>
                  </div>
                </div>
                <span className="onix-chip shrink-0">{ROLE_LABEL[m.role] ?? m.role}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
