import { Suspense } from 'react';
import Link from 'next/link';
import { AI_TYPES, VALUE_TYPES, catalogName, type CatalogOption } from '@onix/templates';
import { Plus } from 'lucide-react';
import { StackBar } from '@/components/charts';
import { CaseDrawer } from '@/components/panels/CaseDrawer';
import { InventoryImportExport } from '@/components/panels/InventoryImportExport';
import { Card, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { Tabs } from '@/components/ui/Tabs';
import { validateCaseAction } from '@/lib/actions/inventory';
import { completeness, loadOrgOverview, missingForPriority, suggestRisk } from '@/lib/server/insights';
import { requireSession } from '@/lib/session';

const RISKS = ['Bajo', 'Medio', 'Alto', 'Inaceptable'];
const STATUSES = ['Propuesto', 'En revisión', 'Aprobado', 'Descartado'];

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; caso?: string; riesgo?: string; estatus?: string; tipo?: string; valor?: string }>;
}) {
  const session = await requireSession();
  const p = await searchParams;
  const tab = p.tab ?? 'casos';
  const o = await loadOrgOverview(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const sector = o.org?.sector ?? null;

  const filtered = o.cases.filter(
    (c) =>
      (!p.riesgo || c.risk === p.riesgo) &&
      (!p.estatus || c.status === p.estatus) &&
      (!p.tipo || c.aiType === p.tipo) &&
      (!p.valor || c.valueType === p.valor),
  );
  const tally = (key: 'aiType' | 'valueType', list: CatalogOption[]) =>
    [...list.map((t) => ({ k: t.k, n: t.n, v: o.cases.filter((c) => c[key] === t.k).length })), { k: '', n: 'Sin clasificar', v: o.cases.filter((c) => !c[key]).length }]
      .filter((x) => x.v > 0)
      .sort((x, y) => y.v - x.v);
  const byType = tally('aiType', AI_TYPES);
  const byValue = tally('valueType', VALUE_TYPES);
  const qs = (patch: Record<string, string | undefined>) => {
    const next = { tab: p.tab, riesgo: p.riesgo, estatus: p.estatus, tipo: p.tipo, valor: p.valor, ...patch };
    const s = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/inventario${s ? `?${s}` : ''}`;
  };
  const selected = p.caso && p.caso !== 'nuevo' ? o.cases.find((c) => c.id === p.caso) ?? null : null;
  const drawerOpen = p.caso === 'nuevo' || Boolean(selected);
  const areas = [...new Set(o.cases.map((c) => c.area || 'Sin área'))]
    .map((a) => ({ a, n: o.cases.filter((c) => (c.area || 'Sin área') === a).length }))
    .sort((x, y) => y.n - x.n);
  const toValidate = o.cases.filter((c) => c.status === 'Propuesto' || c.status === 'En revisión');
  const unprioritized = o.cases.filter((c) => c.status !== 'Descartado' && missingForPriority(c).length > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Ruta IA · paso 2"
        title="Inventario de IA"
        description="Todo lo que la empresa usa o planea usar con IA, con su dueño, su riesgo y lo necesario para priorizarlo."
        actions={
          canWrite ? (
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-start">
              <InventoryImportExport cases={o.cases} />
              <Link href={qs({ caso: 'nuevo' })} className="onix-btn-primary">
                <Plus className="h-4 w-4" /> Nuevo caso
              </Link>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Casos registrados" value={o.cases.length} sub={`${o.cases.filter((c) => c.origin === 'import').length} importados de Excel`} />
        <Kpi label="En producción" value={o.cases.filter((c) => c.inProduction).length} sub="ya operan con usuarios" />
        <Kpi label="Riesgo alto o inaceptable" value={o.cases.filter((c) => c.risk === 'Alto' || c.risk === 'Inaceptable').length} sub={`${toValidate.length} por validar`} />
        <Kpi label="Sin priorizar" value={unprioritized.length} sub="les faltan atributos" />
      </div>

      <div className="mt-6">
        <Suspense fallback={null}>
          <Tabs
            basePath="/inventario"
            items={[
              { id: 'casos', label: 'Casos' },
              { id: 'validaciones', label: `Validaciones${toValidate.length ? ` · ${toValidate.length}` : ''}` },
            ]}
          />
        </Suspense>
      </div>

      {tab === 'casos' ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
          <section className="onix-panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="mr-1 text-[12px] text-ink-subtle">Riesgo</span>
              {RISKS.map((r) => (
                <Link key={r} href={qs({ riesgo: p.riesgo === r ? undefined : r })} className={`rounded-full px-2 py-0.5 text-[12px] ${p.riesgo === r ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}>
                  {r}
                </Link>
              ))}
              <span className="ml-3 mr-1 text-[12px] text-ink-subtle">Estatus</span>
              {STATUSES.map((s) => (
                <Link key={s} href={qs({ estatus: p.estatus === s ? undefined : s })} className={`rounded-full px-2 py-0.5 text-[12px] ${p.estatus === s ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}>
                  {s}
                </Link>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="onix-table">
                <thead>
                  <tr>
                    <th>Caso</th>
                    <th>Dueño</th>
                    <th>Tipo y tecnología</th>
                    <th>Riesgo</th>
                    <th>Estatus</th>
                    <th className="text-right">Ficha</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const comp = completeness(c);
                    return (
                      <tr key={c.id} className="hover:bg-canvas-subtle/60">
                        <td>
                          <Link href={qs({ caso: c.id })} className="block">
                            <span className="text-ink hover:underline">{c.name}</span>
                            <span className="block text-[11px] text-ink-subtle">
                              {c.area || 'Sin área'}
                              {c.inProduction ? ' · en producción' : ''}
                              {c.origin === 'import' ? ' · importado' : ''}
                              {(() => {
                                const n = o.agents.filter((x) => x.useCaseId === c.id).length;
                                return n ? ` · ${n} ${n === 1 ? 'agente' : 'agentes'}` : '';
                              })()}
                            </span>
                          </Link>
                        </td>
                        <td className="text-ink-muted">{c.ownerName ?? '·'}</td>
                        <td className="max-w-[200px] text-ink-muted">
                          <span className="block truncate text-ink">{catalogName(AI_TYPES, c.aiType) ?? 'Sin clasificar'}</span>
                          <span className="block truncate text-[11px] text-ink-subtle">{c.technology ?? '·'}</span>
                        </td>
                        <td>
                          <RiskDot risk={c.risk} />
                        </td>
                        <td className="text-ink-muted">{c.status}</td>
                        <td className="text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1 w-10 overflow-hidden rounded-full bg-canvas-subtle">
                              <span className="block h-full bg-accent" style={{ width: `${(comp.filled / comp.total) * 100}%` }} />
                            </span>
                            <span className="text-[11px] tabular-nums text-ink-subtle">
                              {comp.filled}/{comp.total}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-subtle">
                        No hay casos con estos filtros.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
          <div className="space-y-4">
            <Card title="Por riesgo">
              <StackBar parts={RISKS.map((r, i) => ({ label: r, value: o.cases.filter((c) => c.risk === r).length, tone: (i + 1) as 1 | 2 | 3 | 4 }))} />
            </Card>
            {(['tipo', 'valor'] as const).map((key) => {
              const rows = key === 'tipo' ? byType : byValue;
              const max = Math.max(1, ...rows.map((r) => r.v));
              return (
                <Card key={key} title={key === 'tipo' ? 'Por tipo de IA' : 'Por tipo de valor'}>
                  <div className="space-y-2.5">
                    {rows.map((r) => {
                      const active = p[key] === r.k && r.k !== '';
                      return (
                        <Link key={r.n} href={r.k ? qs({ [key]: active ? undefined : r.k }) : qs({})} className="block">
                          <div className="flex justify-between text-[12px]">
                            <span className={`truncate ${active ? 'font-medium text-accent' : r.k ? 'text-ink' : 'text-ink-subtle'}`}>{r.n}</span>
                            <span className="tabular-nums text-ink-muted">{r.v}</span>
                          </div>
                          <div className="onix-bar mt-1">
                            <div className={`h-full ${r.k ? 'bg-accent' : 'bg-border-strong'}`} style={{ width: `${(r.v / max) * 100}%` }} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
            <Card title="Por área">
              <div className="space-y-2.5">
                {areas.map(({ a, n }) => (
                  <div key={a}>
                    <div className="flex justify-between text-[12px]">
                      <span className="truncate text-ink">{a}</span>
                      <span className="tabular-nums text-ink-muted">{n}</span>
                    </div>
                    <div className="onix-bar mt-1">
                      <div className="h-full bg-accent" style={{ width: `${(n / Math.max(1, areas[0]!.n)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            {unprioritized.length ? (
              <Card title="Alertas">
                <ul className="space-y-2 text-[12px]">
                  {unprioritized.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link href={qs({ caso: c.id })} className="text-ink hover:underline">
                        {c.name}
                      </Link>
                      <span className="block text-ink-subtle">Falta: {missingForPriority(c).join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-[13px] text-ink-muted">
            El triaje propone el nivel de riesgo y quién lo valida. Si los validadores no coinciden, gana el nivel más alto; un caso inaceptable nunca pasa a producción.
          </p>
          {toValidate.map((c) => {
            const s = suggestRisk(c, sector);
            return (
              <section key={c.id} className="onix-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={qs({ caso: c.id, tab: 'casos' })} className="text-[14px] font-medium text-ink hover:underline">
                      {c.name}
                    </Link>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      Registrado como <span className="text-ink">{c.risk}</span> · triaje sugiere <span className="text-ink">{s.level}</span>
                      {s.why.length ? ` (${s.why.join(', ')})` : ''}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-subtle">Validan: {s.validators.join(', ')}</p>
                  </div>
                  {canWrite ? (
                    <form action={validateCaseAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="risk" defaultValue={s.level} className="onix-input w-auto py-1.5 text-[12px]" aria-label="Nivel validado">
                        {RISKS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      <button name="decision" value="aprobar" className="onix-btn-primary py-1.5">
                        Aprobar
                      </button>
                      <button name="decision" value="condicionar" className="onix-btn-ghost py-1.5">
                        Con condiciones
                      </button>
                      <button name="decision" value="rechazar" className="onix-btn-ghost py-1.5">
                        Rechazar
                      </button>
                    </form>
                  ) : null}
                </div>
              </section>
            );
          })}
          {toValidate.length === 0 ? <p className="text-[13px] text-ink-subtle">No hay casos pendientes de validar.</p> : null}
        </div>
      )}

      {drawerOpen ? (
        <CaseDrawer
          c={selected}
          canWrite={canWrite}
          sector={sector}
          closeHref={qs({ caso: undefined })}
          agents={selected ? o.agents.filter((a) => a.useCaseId === selected.id) : []}
        />
      ) : null}
    </div>
  );
}
