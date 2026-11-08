import { Suspense } from 'react';
import { seedPlanFromLibraryAction, updateActionProgressAction } from '@/lib/actions/plan';
import { loadPlanBundle } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { ActionDetailPanel } from '@/components/panels/ActionDetailPanel';

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; actionId?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const tab = params.tab ?? 'etapas';
  const data = await loadPlanBundle(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const selected = data.actions.find((a) => a.id === params.actionId) ?? null;
  const evidence = selected
    ? data.evidences.find((e) => e.actionId === selected.id) ?? null
    : null;

  const myActions = data.actions.filter(
    (a) => a.ownerUserId === session.user.id || !a.ownerUserId,
  );

  return (
    <div>
      <PageHeader
        title="Plan"
        description="Etapas Bases → Controles → Mejora continua. Cierre al 100 requiere evidencia aprobada."
        actions={
          canWrite ? (
            <form action={seedPlanFromLibraryAction}>
              <button type="submit" className="onix-btn-primary">
                Cargar biblioteca
              </button>
            </form>
          ) : null
        }
      />
      <Suspense fallback={null}>
        <Tabs
          basePath="/plan"
          items={[
            { id: 'etapas', label: 'Etapas' },
            { id: 'backlog', label: 'Backlog' },
            { id: 'acciones', label: 'Mis acciones' },
          ]}
        />
      </Suspense>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {tab === 'etapas'
            ? data.stages
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((stage) => {
                  const stageActions = data.actions.filter((a) => a.stageId === stage.id);
                  return (
                    <section key={stage.id} className="onix-panel p-4">
                      <h2 className="text-sm font-medium text-ink">{stage.name}</h2>
                      <ul className="mt-3 space-y-2">
                        {stageActions.map((a) => (
                          <li key={a.id}>
                            <a
                              href={`/plan?tab=etapas&actionId=${a.id}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-canvas-subtle"
                            >
                              <span className="text-ink">{a.title}</span>
                              <span className="text-xs text-ink-muted">{a.progress}%</span>
                            </a>
                          </li>
                        ))}
                        {stageActions.length === 0 ? (
                          <li className="text-sm text-ink-muted">Sin acciones en esta etapa.</li>
                        ) : null}
                      </ul>
                    </section>
                  );
                })
            : null}

          {tab === 'backlog' ? (
            <ul className="divide-y divide-border onix-panel">
              {data.actions.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <a href={`/plan?tab=backlog&actionId=${a.id}`} className="text-ink">
                    {a.title}
                  </a>
                  <span className="text-ink-muted">{a.progress}%</span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === 'acciones' ? (
            <ul className="divide-y divide-border onix-panel">
              {myActions.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <a href={`/plan?tab=acciones&actionId=${a.id}`} className="text-sm text-ink">
                    {a.title}
                  </a>
                  {canWrite ? (
                    <form action={updateActionProgressAction} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="actionId" value={a.id} />
                      <select className="onix-input w-24" name="progress" defaultValue={a.progress}>
                        <option value="0">0</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                      </select>
                      <select className="onix-input w-36" name="evidenceStatus" defaultValue="none">
                        <option value="none">Sin evidencia</option>
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobada</option>
                        <option value="rejected">Rechazada</option>
                      </select>
                      <button type="submit" className="onix-btn-ghost">
                        Actualizar
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {!data.plan ? (
            <p className="text-sm text-ink-muted">Aún no hay plan. Carga la biblioteca de acciones.</p>
          ) : null}
        </div>
        <ActionDetailPanel action={selected} evidence={evidence} canWrite={canWrite} />
      </div>
    </div>
  );
}
