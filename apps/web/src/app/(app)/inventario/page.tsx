import { Suspense } from 'react';
import {
  createUseCaseAction,
  deleteUseCaseAction,
  runTriageAction,
} from '@/lib/actions/inventory';
import { loadAssessmentBundle, loadInventory } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { Tabs } from '@/components/ui/Tabs';
import { InventoryImportExport } from '@/components/panels/InventoryImportExport';
import { CaseDetailPanel } from '@/components/panels/CaseDetailPanel';

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; caseId?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const tab = params.tab ?? 'casos';
  const { cases, validations } = await loadInventory(session.user.organizationId);
  const { assessment } = await loadAssessmentBundle(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const selected = cases.find((c) => c.id === params.caseId) ?? null;

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Casos de uso de IA y validaciones de triage. Discovery solo entra como Propuesto."
        actions={canWrite ? <InventoryImportExport cases={cases} /> : null}
      />
      <Suspense fallback={null}>
        <Tabs
          basePath="/inventario"
          items={[
            { id: 'casos', label: 'Casos' },
            { id: 'validaciones', label: 'Validaciones' },
          ]}
        />
      </Suspense>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {tab === 'casos' ? (
            <div className="space-y-4">
              {canWrite ? (
                <form action={createUseCaseAction} className="onix-panel grid gap-3 p-4 sm:grid-cols-2">
                  <input className="onix-input sm:col-span-2" name="name" required placeholder="Nombre del caso" />
                  <input className="onix-input" name="area" placeholder="Área" />
                  <select className="onix-input" name="risk" defaultValue="Medio">
                    <option>Bajo</option>
                    <option>Medio</option>
                    <option>Alto</option>
                    <option>Inaceptable</option>
                  </select>
                  <select className="onix-input" name="origin" defaultValue="manual">
                    <option value="manual">manual</option>
                    <option value="discovery">discovery</option>
                    <option value="import">import</option>
                  </select>
                  <select className="onix-input" name="status" defaultValue="Propuesto">
                    <option>Propuesto</option>
                    <option>En revisión</option>
                    <option>Aprobado</option>
                    <option>Descartado</option>
                  </select>
                  <textarea
                    className="onix-input sm:col-span-2"
                    name="description"
                    rows={2}
                    placeholder="Descripción"
                  />
                  <button type="submit" className="onix-btn-primary sm:col-span-2 sm:w-fit">
                    Agregar caso
                  </button>
                </form>
              ) : null}

              <ul className="divide-y divide-border onix-panel">
                {cases.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <a href={`/inventario?tab=casos&caseId=${c.id}`} className="min-w-0">
                      <p className="truncate text-sm text-ink">{c.name}</p>
                      <p className="text-xs text-ink-subtle">
                        {c.origin} · {c.status}
                      </p>
                    </a>
                    <div className="flex items-center gap-3">
                      <RiskDot risk={c.risk} />
                      {canWrite ? (
                        <form action={deleteUseCaseAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="text-xs text-danger">
                            Eliminar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
                {cases.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-ink-muted">Sin casos en el inventario.</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              {canWrite && assessment ? (
                <form action={runTriageAction} className="onix-panel space-y-3 p-4">
                  <input type="hidden" name="assessmentId" value={assessment.id} />
                  <input className="onix-input" name="subject" required placeholder="Asunto a validar" />
                  <input
                    className="onix-input"
                    name="opinions"
                    required
                    placeholder="Opiniones separadas por coma (ej. 2,3,3)"
                  />
                  <p className="text-xs text-ink-subtle">
                    Si hay discrepancia, el motor toma el máximo (más conservador).
                  </p>
                  <button type="submit" className="onix-btn-primary">
                    Resolver triage
                  </button>
                </form>
              ) : null}
              <ul className="divide-y divide-border onix-panel">
                {validations.map((v) => (
                  <li key={v.id} className="px-4 py-3 text-sm">
                    <p className="text-ink">{v.subject}</p>
                    <p className="text-xs text-ink-muted">
                      Opiniones: {(v.opinions as number[]).join(', ')} ·{' '}
                      {v.agreed ? 'Acuerdo' : 'Discrepancia → máx'} = {v.resolvedValue}
                    </p>
                  </li>
                ))}
                {validations.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-ink-muted">Sin validaciones.</li>
                ) : null}
              </ul>
            </div>
          )}
        </div>
        <CaseDetailPanel caseRow={selected} canWrite={canWrite} />
      </div>
    </div>
  );
}
