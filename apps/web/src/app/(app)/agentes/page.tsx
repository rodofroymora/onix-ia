import { Suspense } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { AGENT_CHANNELS, AGENT_PLATFORMS, AGENT_PUBLISHERS, AGENT_STATUSES } from '@onix/templates';
import { AgentMap } from '@/components/agents/AgentMap';
import { Card, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { Tabs } from '@/components/ui/Tabs';
import { saveAgentAction } from '@/lib/actions/agents';
import { expandQueryWithModel, loadAgents, searchAgents, type AgentRow } from '@/lib/server/agents';
import { requireSession } from '@/lib/session';

type SP = { tab?: string; q?: string; agente?: string; estado?: string; publicador?: string; plataforma?: string; canal?: string };

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: { k: string; n: string }[] }) {
  return (
    <select name={name} defaultValue={value ?? ''} aria-label={label} className="onix-input w-auto rounded-full py-1 pl-3 pr-7 text-[12px]">
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.k} value={o.k}>
          {o.n}
        </option>
      ))}
    </select>
  );
}

function AgentDrawer({ a, cases, canWrite, closeHref }: { a: AgentRow | null; cases: { id: string; name: string }[]; canWrite: boolean; closeHref: string }) {
  const isNew = !a;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/15">
      <Link href={closeHref} className="flex-1" aria-label="Cerrar" />
      <aside className="h-full w-full max-w-[480px] overflow-y-auto border-l border-border bg-surface shadow-md">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="onix-label">{isNew ? 'Registrar agente' : `${a.platformName} · ${a.vendor}`}</p>
            <p className="mt-1 truncate text-[16px] font-semibold text-ink">{a?.name ?? 'Nuevo agente'}</p>
            {a ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-ink-subtle">
                <RiskDot risk={a.risk as 'Bajo'} />
                <span>{a.status}</span>
                <span>{a.managed ? 'Gestionado' : 'No gestionado'}</span>
                {a.useCaseName ? <span>Caso: {a.useCaseName}</span> : <span>Sin caso en el inventario</span>}
              </div>
            ) : null}
          </div>
          <Link href={closeHref} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Link>
        </div>
        <form action={saveAgentAction} className="space-y-4 px-6 py-5">
          {a ? <input type="hidden" name="id" value={a.id} /> : null}
          <fieldset disabled={!canWrite} className="space-y-4">
            <label className="block text-[12px] text-ink-muted">
              Nombre
              <input name="name" required defaultValue={a?.name ?? ''} className="onix-input mt-1" />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Qué hace
              <textarea name="description" rows={2} defaultValue={a?.description ?? ''} className="onix-input mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[12px] text-ink-muted">
                Plataforma
                <select name="platform" defaultValue={a?.platform ?? 'copilot_studio'} className="onix-input mt-1">
                  {AGENT_PLATFORMS.map((p) => (
                    <option key={p.k} value={p.k}>
                      {p.n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-ink-muted">
                Publicado por
                <select name="publisher" defaultValue={a?.publisher ?? 'Organización'} className="onix-input mt-1">
                  {AGENT_PUBLISHERS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-ink-muted">
                Canal
                <select name="channel" defaultValue={a?.channel ?? 'Teams'} className="onix-input mt-1">
                  {AGENT_CHANNELS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-ink-muted">
                Estado
                <select name="status" defaultValue={a?.status ?? 'Activo'} className="onix-input mt-1">
                  {AGENT_STATUSES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-ink-muted">
                Riesgo
                <select name="risk" defaultValue={a?.risk ?? 'Medio'} className="onix-input mt-1">
                  {['Bajo', 'Medio', 'Alto', 'Inaceptable'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-ink-muted">
                Dueño
                <input name="ownerName" defaultValue={a?.ownerName ?? ''} className="onix-input mt-1" placeholder="Sin dueño" />
              </label>
            </div>
            <label className="block text-[12px] text-ink-muted">
              Caso de uso del inventario
              <select name="useCaseId" defaultValue={a?.useCaseId ?? ''} className="onix-input mt-1">
                <option value="">Ninguno</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] text-ink-muted">
              Fuentes de datos (separadas por coma)
              <input name="dataSources" defaultValue={a?.dataSources.join(', ') ?? ''} className="onix-input mt-1" />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Qué puede hacer (separado por coma)
              <input name="capabilities" defaultValue={a?.capabilities.join(', ') ?? ''} className="onix-input mt-1" />
            </label>
            <div className="grid grid-cols-2 items-end gap-3">
              <label className="text-[12px] text-ink-muted">
                Usuarios al mes
                <input name="monthlyUsers" inputMode="numeric" defaultValue={a?.monthlyUsers ?? 0} className="onix-input mt-1 tabular-nums" />
              </label>
              <label className="flex items-center gap-2 pb-2 text-[13px] text-ink">
                <input type="checkbox" name="managed" defaultChecked={a?.managed ?? true} className="h-4 w-4 accent-[var(--onix-accent)]" />
                Gestionado por TI
              </label>
            </div>
          </fieldset>
          {canWrite ? <button className="onix-btn-primary w-full">{isNew ? 'Registrar agente' : 'Guardar cambios'}</button> : null}
        </form>
      </aside>
    </div>
  );
}

export default async function AgentesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession();
  const p = await searchParams;
  const tab = p.tab ?? 'mapa';
  const canWrite = session.user.role !== 'client_reader';
  const { agents, cases } = await loadAgents(session.user.organizationId);

  const filtered = agents.filter(
    (a) =>
      (!p.estado || a.status === p.estado) &&
      (!p.publicador || a.publisher === p.publicador) &&
      (!p.plataforma || a.platform === p.plataforma) &&
      (!p.canal || a.channel === p.canal),
  );
  const q = (p.q ?? '').trim().slice(0, 200);
  const extra = q ? await expandQueryWithModel(q) : [];
  const hits = q ? searchAgents(q, filtered, extra) : null;
  const hitIds = hits ? hits.map((h) => h.id) : null;
  const list = hits ? hits.map((h) => filtered.find((a) => a.id === h.id)!).filter(Boolean) : filtered;

  const atRisk = agents.filter((a) => a.risk === 'Alto' || a.risk === 'Inaceptable');
  const noOwner = agents.filter((a) => !a.ownerName);
  const unmanaged = agents.filter((a) => !a.managed);
  const idle = agents.filter((a) => a.status === 'Inactivo');
  const selected = p.agente === 'nuevo' ? null : p.agente ? agents.find((a) => a.id === p.agente) ?? null : undefined;
  const href = (patch: Partial<SP>) => {
    const next = { ...p, ...patch };
    const s = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/agentes${s ? `?${s}` : ''}`;
  };
  const filterKeys: (keyof SP)[] = ['estado', 'publicador', 'plataforma', 'canal'];
  const activeFilters = filterKeys.filter((k) => p[k]).length;

  return (
    <div>
      <PageHeader
        eyebrow="Operación"
        title="Agent Discovery"
        description="Todos los agentes de IA que existen en la organización, dónde viven, quién responde por ellos y cuáles están fuera de control."
        actions={
          canWrite ? (
            <Link href={href({ agente: 'nuevo' })} className="onix-btn-primary">
              Registrar agente
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Agentes totales" value={agents.length} sub={`${new Set(agents.map((a) => a.platform)).size} plataformas`} />
        <Kpi label="En riesgo" value={atRisk.length} sub="riesgo alto o inaceptable" />
        <Kpi label="Sin dueño" value={noOwner.length} sub={noOwner.slice(0, 2).map((a) => a.name).join(', ') || 'Todos tienen dueño'} />
        <Kpi label="No gestionados" value={unmanaged.length} sub={`${idle.length} inactivos para retirar`} />
      </div>

      <form action="/agentes" className="mt-6 flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={tab} />
        <label className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Busca por contexto: ¿hay algo que lea contratos?, agentes con datos de clientes, cobranza…"
            className="onix-input rounded-full pl-9"
          />
        </label>
        <Select name="estado" label="Estado" value={p.estado} options={AGENT_STATUSES.map((s) => ({ k: s, n: s }))} />
        <Select name="publicador" label="Publicado por" value={p.publicador} options={AGENT_PUBLISHERS.map((s) => ({ k: s, n: s }))} />
        <Select name="plataforma" label="Plataforma" value={p.plataforma} options={AGENT_PLATFORMS} />
        <Select name="canal" label="Canal" value={p.canal} options={AGENT_CHANNELS.map((s) => ({ k: s, n: s }))} />
        <button className="onix-btn-ghost rounded-full py-1.5">Buscar</button>
        {q || activeFilters ? (
          <Link href={`/agentes?tab=${tab}`} className="text-[12px] text-ink-muted hover:text-ink">
            Limpiar
          </Link>
        ) : null}
      </form>

      {hits ? (
        <p className="mt-3 text-[13px] text-ink-muted">
          {hits.length ? `${hits.length} agentes relacionados con "${q}"` : `Nada relacionado con "${q}". Prueba con otras palabras o registra el agente.`}
          {extra.length ? <span className="text-ink-subtle"> · también buscamos: {extra.join(', ')}</span> : null}
        </p>
      ) : null}

      <div className="mt-5">
        <Suspense fallback={null}>
          <Tabs
            basePath="/agentes"
            items={[
              { id: 'mapa', label: 'Mapa' },
              { id: 'registro', label: `Registro · ${list.length}` },
            ]}
          />
        </Suspense>
      </div>

      {tab === 'mapa' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="onix-panel p-3">
            <Suspense fallback={null}>
              <AgentMap
                agents={filtered.map((a) => ({
                  id: a.id,
                  name: a.name,
                  platform: a.platform,
                  platformName: a.platformName,
                  vendor: a.vendor,
                  risk: a.risk,
                  managed: a.managed,
                  status: a.status,
                  ownerName: a.ownerName,
                  monthlyUsers: a.monthlyUsers,
                  dataSources: a.dataSources,
                }))}
                highlight={hitIds}
              />
            </Suspense>
          </div>
          <Card title={hits ? 'Resultados' : 'Requieren atención'}>
            <ul className="-my-1 divide-y divide-border">
              {(hits ? list : [...unmanaged, ...noOwner.filter((a) => a.managed), ...atRisk.filter((a) => a.managed && a.ownerName)]).slice(0, 9).map((a) => {
                const h = hits?.find((x) => x.id === a.id);
                return (
                  <li key={a.id}>
                    <Link href={href({ agente: a.id })} className="block py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-ink">{a.name}</span>
                        {h ? <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{h.score}%</span> : <RiskDot risk={a.risk as 'Bajo'} />}
                      </div>
                      <p className="truncate text-[11px] text-ink-subtle">
                        {h ? `coincide en ${h.why.join(', ')}` : `${a.platformName} · ${!a.managed ? 'no gestionado' : !a.ownerName ? 'sin dueño' : `riesgo ${a.risk}`}`}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : (
        <section className="onix-panel mt-5 overflow-x-auto">
          <table className="onix-table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Plataforma</th>
                <th>Canal</th>
                <th>Dueño</th>
                <th>Riesgo</th>
                <th>Estado</th>
                <th className="text-right">Usuarios al mes</th>
                {hits ? <th className="text-right">Coincidencia</th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-canvas-subtle/60">
                  <td>
                    <Link href={href({ agente: a.id })} className="hover:underline">
                      {a.name}
                    </Link>
                    <span className="block text-[11px] text-ink-subtle">
                      {a.publisher}
                      {a.managed ? '' : ' · no gestionado'}
                      {a.useCaseName ? ` · ${a.useCaseName}` : ''}
                    </span>
                  </td>
                  <td className="text-ink-muted">{a.platformName}</td>
                  <td className="text-ink-muted">{a.channel}</td>
                  <td className={a.ownerName ? 'text-ink-muted' : 'text-danger'}>{a.ownerName ?? 'Sin dueño'}</td>
                  <td>
                    <RiskDot risk={a.risk as 'Bajo'} />
                  </td>
                  <td className="text-ink-muted">{a.status}</td>
                  <td className="text-right tabular-nums">{a.monthlyUsers.toLocaleString('es-MX')}</td>
                  {hits ? <td className="text-right tabular-nums text-ink-muted">{hits.find((h) => h.id === a.id)?.score}%</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-4 text-[11px] text-ink-subtle">
        Hoy los agentes se registran a mano o se descubren en la telemetría. La conexión directa con Microsoft 365, Google y AWS para descubrirlos solos está en el roadmap.
      </p>

      {selected !== undefined ? <AgentDrawer a={selected} cases={cases} canWrite={canWrite} closeHref={href({ agente: undefined })} /> : null}
    </div>
  );
}
