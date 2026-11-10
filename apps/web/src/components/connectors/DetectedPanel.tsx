import Link from 'next/link';
import { Radar } from 'lucide-react';
import { RiskDot } from '@/components/ui/RiskDot';
import { linkDiscoveredAction, registerDiscoveredAction, setDiscoveredStatusAction } from '@/lib/actions/connectors';
import type { DiscoveredRow } from '@/lib/server/connectors';
import { SOURCE_LABEL, type DiscoveredInput } from '@/lib/connectors/types';
import { describeScopes } from '@/lib/connectors/catalog';

const VIEWS = [
  ['nuevo', 'Por revisar'],
  ['registrado', 'Registrados'],
  ['ignorado', 'Ignorados'],
  ['desaparecido', 'Ya no aparecen'],
] as const;

const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export function DetectedPanel({
  items,
  view,
  canWrite,
  agents,
  hrefFor,
  hasConnectors,
}: {
  items: DiscoveredRow[];
  view: string;
  canWrite: boolean;
  agents: { id: string; name: string }[];
  hrefFor: (v: string) => string;
  hasConnectors: boolean;
}) {
  const current = VIEWS.some(([k]) => k === view) ? view : 'nuevo';
  const RANK: Record<string, number> = { Alto: 0, Medio: 1, Bajo: 2 };
  const shown = items
    .filter((i) => i.status === current)
    .sort(
      (a, b) =>
        (RANK[a.suggestedRisk ?? ''] ?? 3) - (RANK[b.suggestedRisk ?? ''] ?? 3) ||
        Number((b.details as { orgWide?: boolean }).orgWide ?? false) - Number((a.details as { orgWide?: boolean }).orgWide ?? false) ||
        (b.usersCount ?? 0) - (a.usersCount ?? 0),
    );
  const count = (k: string) => items.filter((i) => i.status === k).length;

  if (!items.length) {
    return (
      <div className="onix-panel mt-5 flex flex-col items-center px-6 py-12 text-center">
        <Radar className="h-6 w-6 text-accent" strokeWidth={1.6} />
        <p className="mt-3 text-[15px] font-medium text-ink">Aún no hay detecciones</p>
        <p className="mt-1 max-w-md text-[13px] text-ink-muted">
          {hasConnectors
            ? 'La próxima revisión diaria traerá lo que encuentre en tu nube.'
            : 'Conecta Microsoft 365 o AWS y Ónix encontrará las apps de IA y los agentes que ya usa tu organización.'}
        </p>
        <Link href="/agentes?tab=conexiones" className="onix-btn-primary mt-4">
          {hasConnectors ? 'Ver conectores' : 'Conectar mi nube'}
        </Link>
      </div>
    );
  }

  return (
    <section className="mt-5">
      <div className="onix-scroll-x mb-3 flex gap-1 text-[13px]">
        {VIEWS.map(([k, l]) => (
          <Link key={k} href={hrefFor(k)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 ${current === k ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}>
            {l} · {count(k)}
          </Link>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="onix-panel px-5 py-8 text-center text-[13px] text-ink-muted">Nada en esta lista.</p>
      ) : (
        <div className="onix-panel overflow-hidden">
          <table className="onix-table">
            <thead>
              <tr>
                <th>Detectado</th>
                <th>Fuente</th>
                <th>Quién la usa</th>
                <th>Riesgo sugerido</th>
                <th>Visto</th>
                {canWrite ? <th className="text-right">Qué hacer</th> : null}
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const d = i.details as { category?: string; scopes?: string[]; orgWide?: boolean; region?: string; status?: string };
                const agent = i.agentId ? agents.find((a) => a.id === i.agentId) : null;
                return (
                  <tr key={i.id}>
                    <td>
                      <span className="text-ink">{i.name}</span>
                      <span className="block text-[11px] text-ink-subtle">
                        {[i.kind === 'app' ? d.category ?? 'App de IA' : 'Agente', i.vendor, d.region].filter(Boolean).join(' · ')}
                      </span>
                      {i.kind === 'app' ? (
                        <span className="mt-0.5 block text-[11px] text-ink-subtle" title={(d.scopes ?? []).join(', ')}>
                          {describeScopes(d.scopes ?? []).length ? `Puede: ${describeScopes(d.scopes ?? []).join(', ')}` : 'Solo datos básicos de perfil'}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-ink-muted">{SOURCE_LABEL[i.source as DiscoveredInput['source']] ?? i.source}</td>
                    <td className="text-ink-muted">
                      {d.orgWide ? 'Toda la organización' : i.usersCount != null ? `${i.usersCount} ${i.usersCount === 1 ? 'persona' : 'personas'}` : i.ownerName ?? 'Sin dato'}
                    </td>
                    <td>{i.suggestedRisk ? <RiskDot risk={i.suggestedRisk as 'Bajo'} /> : <span className="text-ink-subtle">Por definir</span>}</td>
                    <td className="text-ink-muted">
                      {fmt(i.lastSeenAt)}
                      <span className="block text-[11px] text-ink-subtle">desde {fmt(i.firstSeenAt)}</span>
                    </td>
                    {canWrite ? (
                      <td className="text-right">
                        {i.status === 'nuevo' || i.status === 'desaparecido' ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <form action={registerDiscoveredAction}>
                              <input type="hidden" name="itemId" value={i.id} />
                              <button className="onix-btn-primary py-1 text-[12px]">Registrar</button>
                            </form>
                            {agents.length ? (
                              <form action={linkDiscoveredAction} className="flex items-center gap-1">
                                <input type="hidden" name="itemId" value={i.id} />
                                <select name="agentId" aria-label="Agente existente" className="onix-input w-auto max-w-[150px] py-1 text-[12px]" required defaultValue="">
                                  <option value="" disabled>
                                    Ya existe como…
                                  </option>
                                  {agents.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                                <button className="onix-btn-ghost py-1 text-[12px]">Vincular</button>
                              </form>
                            ) : null}
                            <form action={setDiscoveredStatusAction}>
                              <input type="hidden" name="itemId" value={i.id} />
                              <input type="hidden" name="to" value="ignorado" />
                              <button className="text-[12px] text-ink-subtle hover:text-ink">Ignorar</button>
                            </form>
                          </div>
                        ) : i.status === 'registrado' ? (
                          agent ? (
                            <Link href={`/agentes?agente=${agent.id}`} className="text-[12px] text-accent hover:underline">
                              Ver {agent.name}
                            </Link>
                          ) : (
                            <span className="text-[12px] text-ink-subtle">Registrado</span>
                          )
                        ) : (
                          <form action={setDiscoveredStatusAction}>
                            <input type="hidden" name="itemId" value={i.id} />
                            <input type="hidden" name="to" value="nuevo" />
                            <button className="text-[12px] text-accent hover:underline">Volver a revisar</button>
                          </form>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-subtle">
        El riesgo sugerido sale de los permisos que la app tiene sobre correo, archivos, chats y directorio. Tu equipo lo confirma al registrar.
      </p>
    </section>
  );
}
