import { Suspense } from 'react';
import Link from 'next/link';
import { DIMS } from '@onix/engine';
import { MeterRow, Ring } from '@/components/charts';
import { ActionDrawer } from '@/components/panels/ActionDrawer';
import { Card, Empty, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { seedPlanFromLibraryAction } from '@/lib/actions/plan';
import { saveTargetsAction } from '@/lib/actions/tech';
import { actionProgress, loadOrgOverview, type ActionRow } from '@/lib/server/insights';
import { requireSession } from '@/lib/session';

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha';

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; accion?: string; dim?: string }>;
}) {
  const session = await requireSession();
  const p = await searchParams;
  const tab = p.tab ?? 'etapas';
  const o = await loadOrgOverview(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const isConsultant = session.user.role === 'consultant';
  const today = new Date().toISOString().slice(0, 10);
  const dimName = (k: string | null) => DIMS.find((d) => d.k === k)?.n ?? 'General';
  const evOf = (id: string) => o.evidences.filter((e) => e.actionId === id);
  const evState = (id: string) => {
    const ev = evOf(id);
    if (ev.some((e) => e.status === 'approved')) return 'Aprobada';
    if (ev.some((e) => e.status === 'pending')) return 'Por revisar';
    if (ev.some((e) => e.status === 'rejected')) return 'Rechazada';
    return null;
  };
  const href = (patch: Record<string, string | undefined>) => {
    const next = { tab: p.tab, dim: p.dim, ...patch };
    const s = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/plan${s ? `?${s}` : ''}`;
  };
  const selected = p.accion ? o.actions.find((a) => a.id === p.accion) ?? null : null;
  const stageName = (id: string) => o.stages.find((s) => s.id === id)?.name ?? '';
  const critical = o.actions.filter((a) => a.critical && actionProgress(a) < 100);
  const closed = o.actions.filter((a) => actionProgress(a) === 100);

  const ActionCard = ({ a }: { a: ActionRow }) => {
    const ev = evState(a.id);
    const late = a.dueDate && a.dueDate < today && actionProgress(a) < 100;
    return (
      <Link href={href({ accion: a.id })} className="block rounded-lg border border-border bg-surface px-3.5 py-3 transition hover:border-border-strong">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] leading-snug text-ink">{a.title}</p>
          {a.critical ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" title="Crítica" /> : null}
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-canvas-subtle">
          <div className="h-full bg-accent" style={{ width: `${actionProgress(a)}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-subtle">
          <span>{dimName(a.dimension)}</span>
          <span className={late ? 'text-danger' : ''}>
            {actionProgress(a)}% · {fmtDate(a.dueDate)}
            {ev ? ` · ${ev}` : ''}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Ruta IA · paso 4"
        title="Plan por etapas"
        description="Las acciones salen de las brechas, los casos priorizados y las condiciones del triaje. Ninguna se cierra sin evidencia."
        actions={
          canWrite ? (
            <form action={seedPlanFromLibraryAction}>
              <button className="onix-btn-ghost">Sugerir acciones de la biblioteca</button>
            </form>
          ) : null
        }
      />

      {o.actions.length === 0 ? (
        <Empty title="El plan está vacío">Sugiere acciones desde la biblioteca para empezar; luego ajusta dueños y fechas.</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="onix-panel flex items-center justify-between px-5 py-4">
              <div>
                <p className="onix-card-title">Avance</p>
                <p className="mt-2 text-[12px] text-ink-subtle">promedio de {o.actions.length} acciones</p>
              </div>
              <Ring value={o.planPct} size={60} />
            </div>
            <Kpi label="Cerradas con evidencia" value={closed.length} sub={`de ${o.actions.length}`} />
            <Kpi label="Críticas pendientes" value={critical.length} sub="controles de Bases y de riesgo alto" />
            <Kpi label="Vencidas" value={o.overdue.length} sub={o.overdue[0]?.title ?? 'Todo en tiempo'} />
          </div>

          <div className="mt-6">
            <Suspense fallback={null}>
              <Tabs
                basePath="/plan"
                items={[
                  { id: 'etapas', label: 'Etapas' },
                  { id: 'backlog', label: 'Backlog' },
                  { id: 'madurez', label: 'Madurez proyectada' },
                ]}
              />
            </Suspense>
          </div>

          {tab === 'etapas' ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {o.stages.map((s, i) => {
                const acts = o.actions.filter((a) => a.stageId === s.id);
                const pct = acts.length ? Math.round(acts.reduce((t, a) => t + actionProgress(a), 0) / acts.length) : 0;
                return (
                  <section key={s.id} className="rounded-xl bg-canvas-subtle/70 p-3">
                    <div className="mb-3 flex items-baseline justify-between px-1">
                      <p className="text-[13px] font-medium text-ink">
                        {s.name} <span className="text-ink-subtle">· {['0 a 3', '3 a 6', '6 a 12'][i]} meses</span>
                      </p>
                      <span className="text-[12px] tabular-nums text-ink-muted">{pct}%</span>
                    </div>
                    <div className="space-y-2">
                      {acts
                        .sort((x, y) => Number(y.critical) - Number(x.critical) || (x.dueDate ?? '').localeCompare(y.dueDate ?? ''))
                        .map((a) => (
                          <ActionCard key={a.id} a={a} />
                        ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {tab === 'backlog' ? (
            <section className="onix-panel mt-6 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
                <span className="mr-1 text-[12px] text-ink-subtle">Dimensión</span>
                <Link href={href({ dim: undefined })} className={`rounded-full px-2 py-0.5 text-[12px] ${!p.dim ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink'}`}>
                  Todas
                </Link>
                {DIMS.map((d) => (
                  <Link key={d.k} href={href({ dim: d.k })} className={`rounded-full px-2 py-0.5 text-[12px] ${p.dim === d.k ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink'}`}>
                    {d.n.split(' ')[0]}
                  </Link>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="onix-table">
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th>Etapa</th>
                      <th>Avance</th>
                      <th>Fecha</th>
                      <th>Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.actions
                      .filter((a) => !p.dim || a.dimension === p.dim)
                      .sort((x, y) => (x.dueDate ?? '9').localeCompare(y.dueDate ?? '9'))
                      .map((a) => {
                        const late = a.dueDate && a.dueDate < today && actionProgress(a) < 100;
                        return (
                          <tr key={a.id} className="hover:bg-canvas-subtle/60">
                            <td>
                              <Link href={href({ accion: a.id })} className="hover:underline">
                                {a.title}
                              </Link>
                              <span className="block text-[11px] text-ink-subtle">
                                {dimName(a.dimension)}
                                {a.critical ? ' · crítica' : ''}
                              </span>
                            </td>
                            <td className="text-ink-muted">{stageName(a.stageId)}</td>
                            <td>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-1 w-14 overflow-hidden rounded-full bg-canvas-subtle">
                                  <span className="block h-full bg-accent" style={{ width: `${actionProgress(a)}%` }} />
                                </span>
                                <span className="text-[12px] tabular-nums text-ink-muted">{a.progress}%</span>
                              </span>
                            </td>
                            <td className={late ? 'text-danger' : 'text-ink-muted'}>{fmtDate(a.dueDate)}</td>
                            <td className="text-ink-muted">{evState(a.id) ?? '·'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === 'madurez' ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
              <Card title="Actual, proyectado y meta" aside={<span className="onix-chip">escala 0 a 100</span>}>
                <div className="space-y-5">
                  {o.projection.map((pr) => (
                    <MeterRow
                      key={pr.dimension}
                      label={dimName(pr.dimension)}
                      value={pr.current}
                      projected={pr.projected}
                      target={pr.target}
                      hint={
                        pr.targetUnreachable
                          ? `Ni con todas sus acciones al 100% llega a la meta (máximo ${Math.min(100, pr.current + pr.potential)}). Agrega acciones o ajusta la meta.`
                          : `Sus acciones suman hasta ${pr.potential} puntos.`
                      }
                    />
                  ))}
                </div>
                <p className="mt-5 text-[11px] text-ink-subtle">
                  La proyección suma el avance de cada acción a su dimensión, con tope de un nivel por ciclo; Gestionado exige tres meses operando. El nivel oficial solo cambia con la reevaluación.
                </p>
              </Card>
              <Card title="Metas por dimensión">
                <form action={saveTargetsAction} className="space-y-3">
                  {DIMS.map((d) => (
                    <label key={d.k} className="flex items-center justify-between gap-3 text-[13px] text-ink">
                      {d.n}
                      <input
                        type="number"
                        name={`target:${d.k}`}
                        min={0}
                        max={100}
                        defaultValue={o.targets[d.k] ?? ''}
                        disabled={!canWrite}
                        className="onix-input w-20 py-1 text-right tabular-nums"
                      />
                    </label>
                  ))}
                  {canWrite ? <button className="onix-btn-primary mt-2 w-full">Guardar metas</button> : null}
                  <p className="text-[11px] text-ink-subtle">La meta no debería subir más de 37 puntos (1.5 niveles) en doce meses.</p>
                </form>
              </Card>
            </div>
          ) : null}
        </>
      )}

      {selected ? (
        <ActionDrawer
          a={selected}
          stageName={stageName(selected.stageId)}
          evidence={evOf(selected.id)}
          canWrite={canWrite}
          isConsultant={isConsultant}
          closeHref={href({ accion: undefined })}
        />
      ) : null}
    </div>
  );
}
