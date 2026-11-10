import { Suspense } from 'react';
import Link from 'next/link';
import { Search, Sparkles, X } from 'lucide-react';
import { AGENT_CHANNELS, AGENT_PLATFORMS, AGENT_PUBLISHERS, AGENT_STATUSES } from '@onix/templates';
import { AgentMap } from '@/components/agents/AgentMap';
import { AiText } from '@/components/assistant/AiText';
import { Card, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { Tabs } from '@/components/ui/Tabs';
import { createCaseFromAgentAction, saveAgentAction } from '@/lib/actions/agents';
import { askAboutAgents, loadAgents, type AgentRow } from '@/lib/server/agents';
import { requireSession } from '@/lib/session';
import { DetectedPanel } from '@/components/connectors/DetectedPanel';
import { loadConnectors, loadDiscovered } from '@/lib/server/connectors';

type SP = { tab?: string; q?: string; agente?: string; estado?: string; publicador?: string; plataforma?: string; canal?: string; ambito?: string; vista?: string };

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
        {a && a.riskMismatch ? (
          <div className="mx-6 mt-5 rounded-lg border border-border bg-canvas-subtle px-4 py-3 text-[12px] text-ink-muted">
            <span className="text-warning">Riesgo distinto.</span> Este agente tiene riesgo <span className="text-ink">{a.risk}</span>, pero su caso del inventario dice{' '}
            <span className="text-ink">{a.caseRisk}</span>. Revisa el caso para que el triaje y los controles cubran lo que de verdad corre.
          </div>
        ) : null}
        {a && a.useCaseId ? (
          <div className="mx-6 mt-5 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-ink-muted">
              Caso del inventario: <span className="text-ink">{a.useCaseName}</span>
            </span>
            <Link href={`/inventario?caso=${a.useCaseId}`} className="shrink-0 text-accent hover:underline">
              Abrir caso
            </Link>
          </div>
        ) : null}
        {a && !a.useCaseId && canWrite ? (
          <form action={createCaseFromAgentAction} className="mx-6 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
            <input type="hidden" name="agentId" value={a.id} />
            <span className="text-[12px] text-ink-muted">Este agente no tiene caso en el inventario, así que nadie ha evaluado su riesgo ni su valor.</span>
            <button className="onix-btn-ghost py-1.5">Crear caso desde este agente</button>
          </form>
        ) : null}
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
                <select name="status" defaultValue={a?.status ?? 'En producción'} className="onix-input mt-1">
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
  const [{ agents, cases }, discovered, conn] = await Promise.all([
    loadAgents(session.user.organizationId),
    loadDiscovered(session.user.organizationId),
    loadConnectors(session.user.organizationId),
  ]);
  const newDetections = discovered.filter((d) => d.status === 'nuevo').length;

  const scope = p.ambito === 'todos' ? 'todos' : 'produccion';
  const filtered = agents.filter(
    (a) =>
      (scope === 'todos' || a.status === 'En producción') &&
      (!p.estado || a.status === p.estado) &&
      (!p.publicador || a.publisher === p.publicador) &&
      (!p.plataforma || a.platform === p.plataforma) &&
      (!p.canal || a.channel === p.canal),
  );
  const q = (p.q ?? '').trim().slice(0, 200);
  const ai = q ? await askAboutAgents(q, filtered) : null;
  const hits = ai ? ai.hits : null;
  const hitIds = hits ? hits.map((h) => h.id) : null;
  const list = hits ? hits.map((h) => filtered.find((a) => a.id === h.id)!).filter(Boolean) : filtered;

  const atRisk = agents.filter((a) => a.risk === 'Alto' || a.risk === 'Inaceptable');
  const noOwner = agents.filter((a) => !a.ownerName);
  const unmanaged = agents.filter((a) => !a.managed);
  const inProd = agents.filter((a) => a.status === 'En producción');
  const noCase = agents.filter((a) => !a.useCaseId);
  const mismatch = agents.filter((a) => a.riskMismatch);
  const idle = agents.filter((a) => a.status === 'Inactivo');
  const selected =
    p.agente === 'nuevo' ? null : p.agente && !p.agente.startsWith('caso:') ? agents.find((a) => a.id === p.agente && !a.fromInventory) ?? null : undefined;
  const openHref = (a: AgentRow) => (a.fromInventory ? `/inventario?caso=${a.useCaseId}` : href({ agente: a.id }));
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="En producción" value={inProd.length} sub={`de ${agents.length} en ${new Set(agents.map((a) => a.platform)).size} plataformas`} />
        <Kpi label="En riesgo" value={atRisk.length} sub={mismatch.length ? `riesgo alto o inaceptable · ${mismatch.length} distinto a su caso` : 'riesgo alto o inaceptable'} />
        <Kpi label="Sin caso en el inventario" value={noCase.length} sub={`${unmanaged.length} no gestionados · ${noOwner.length} sin dueño`} />
        <Kpi label="Inactivos" value={idle.length} sub="candidatos a retirar" />
      </div>

      {tab !== 'detectados' ? (
      <>
      <div className="mt-6 flex flex-wrap items-center gap-1 text-[13px]">
        {(
          [
            ['produccion', `En producción · ${inProd.length}`],
            ['todos', `Todos · ${agents.length}`],
          ] as const
        ).map(([k, l]) => (
          <Link
            key={k}
            href={href({ ambito: k === 'produccion' ? undefined : k })}
            className={`whitespace-nowrap rounded-full px-3 py-1 ${scope === k ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}
          >
            {l}
          </Link>
        ))}
        <span className="mt-1 w-full text-[12px] text-ink-subtle sm:ml-2 sm:mt-0 sm:w-auto">Incluye los casos del inventario en producción, aunque no tengan agente registrado.</span>
      </div>

      <form action="/agentes" className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={tab} />
        {scope === 'todos' ? <input type="hidden" name="ambito" value="todos" /> : null}
        <label className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Pregúntale al Asistente: ¿hay algo que lea contratos?, ¿qué agentes tocan datos de clientes?"
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

      {ai ? (
        <div className="onix-glass mt-4 flex gap-3 rounded-xl px-4 py-3.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.6} />
          <div className="min-w-0">
            <AiText text={ai.answer} compact />
            <p className="mt-1 text-[11px] text-ink-subtle">
              {ai.source === 'llm' ? 'Respuesta del Asistente Ónix con el catálogo de agentes' : 'Búsqueda por contexto (sin modelo)'} · {hits!.length}{' '}
              {hits!.length === 1 ? 'agente' : 'agentes'} relacionados
              {ai.llmError ? <span className="text-warning"> · {ai.llmError}</span> : null}
            </p>
          </div>
        </div>
      ) : null}
      </>
      ) : null}

      <div className="mt-5">
        <Suspense fallback={null}>
          <Tabs
            basePath="/agentes"
            items={[
              { id: 'mapa', label: 'Mapa' },
              { id: 'registro', label: `Registro · ${list.length}` },
              { id: 'detectados', label: newDetections ? `Detectados · ${newDetections} por revisar` : 'Detectados' },
            ]}
          />
        </Suspense>
      </div>

      {tab !== 'detectados' && newDetections ? (
        <Link href="/agentes?tab=detectados" className="onix-glass mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-[13px]">
          <span className="text-ink">
            Los conectores encontraron <strong className="font-semibold">{newDetections}</strong> {newDetections === 1 ? 'app o agente' : 'apps o agentes'} que no están en el registro.
          </span>
          <span className="shrink-0 text-accent">Revisar</span>
        </Link>
      ) : null}

      {tab === 'detectados' ? (
        <DetectedPanel
          items={discovered}
          view={p.vista ?? 'nuevo'}
          canWrite={canWrite}
          agents={agents.filter((a) => !a.fromInventory).map((a) => ({ id: a.id, name: a.name }))}
          hrefFor={(v) => `/agentes?tab=detectados${v === 'nuevo' ? '' : `&vista=${v}`}`}
          hasConnectors={conn.list.length > 0}
        />
      ) : tab === 'mapa' ? (
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
                  fromInventory: a.fromInventory,
                  useCaseId: a.useCaseId,
                }))}
                highlight={hitIds}
              />
            </Suspense>
          </div>
          <Card title={hits ? 'Resultados' : 'Requieren atención'}>
            <ul className="-my-1 divide-y divide-border">
              {(hits ? list : [...new Set([...mismatch, ...filtered.filter((a) => !a.useCaseId && (a.risk === 'Alto' || a.risk === 'Inaceptable' || !a.managed)), ...filtered.filter((a) => !a.ownerName)])]).slice(0, 9).map((a) => {
                const h = hits?.find((x) => x.id === a.id);
                return (
                  <li key={a.id}>
                    <Link href={openHref(a)} className="block py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-ink">{a.name}</span>
                        {h ? <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{h.score}%</span> : <RiskDot risk={a.risk as 'Bajo'} />}
                      </div>
                      <p className="truncate text-[11px] text-ink-subtle">
                        {h ? (ai?.source === 'llm' ? h.why[0] : `coincide en ${h.why.join(', ')}`) : `${a.platformName} · ${a.riskMismatch ? 'riesgo distinto a su caso' : !a.useCaseId ? 'sin caso en el inventario' : !a.managed ? 'no gestionado' : 'sin dueño'}`}
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
                <th>Caso del inventario</th>
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
                    <Link href={openHref(a)} className="hover:underline">
                      {a.name}
                    </Link>
                    {a.fromInventory ? <span className="ml-2 onix-chip">del inventario</span> : null}
                    <span className="block text-[11px] text-ink-subtle">
                      {a.publisher}
                      {a.managed ? '' : ' · no gestionado'}
                      {a.useCaseName ? ` · ${a.useCaseName}` : ''}
                    </span>
                  </td>
                  <td className="text-ink-muted">{a.platformName}</td>
                  <td className={a.useCaseId ? 'text-ink-muted' : 'text-danger'}>
                    {a.useCaseId ? (
                      <Link href={`/inventario?caso=${a.useCaseId}`} className="hover:underline">
                        {a.useCaseName}
                      </Link>
                    ) : (
                      'Sin caso'
                    )}
                    {a.riskMismatch ? <span className="block text-[11px] text-warning">riesgo distinto al del caso</span> : null}
                  </td>
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
        Los agentes se registran a mano, llegan de los conectores con Microsoft 365 y AWS, o se descubren en la telemetría. Los casos en producción del inventario aparecen aquí aunque no tengan agente registrado.
      </p>

      {selected !== undefined ? <AgentDrawer a={selected} cases={cases} canWrite={canWrite} closeHref={href({ agente: undefined })} /> : null}
    </div>
  );
}
