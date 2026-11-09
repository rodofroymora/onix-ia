'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Maximize2, Minus, Plus } from 'lucide-react';

export interface MapAgent {
  id: string;
  name: string;
  platform: string;
  platformName: string;
  vendor: string;
  risk: string;
  managed: boolean;
  status: string;
  ownerName: string | null;
  monthlyUsers: number;
  dataSources: string[];
  fromInventory?: boolean;
  useCaseId?: string | null;
}

type Kind = 'platform' | 'agent' | 'data';
interface Node {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
  agent?: MapAgent;
  members?: MapAgent[];
}
interface Link {
  s: string;
  t: string;
  len: number;
  k: number;
}

const RISK_FILL: Record<string, string> = {
  Bajo: 'var(--onix-chart-neutral)',
  Medio: 'var(--onix-accent)',
  Alto: 'var(--onix-warning)',
  Inaceptable: 'var(--onix-danger)',
};
const VB_W = 900;
const VB_H = 560;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const initials = (s: string) =>
  s
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, '')
    .split(' ')
    .filter((w) => w.length > 1 || /[A-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

const dotR = (a: MapAgent) => 5 + Math.min(4, Math.log10(1 + a.monthlyUsers) * 1.2);

/** Posición de cada agente dentro de su burbuja (espiral de girasol). */
function packInside(members: MapAgent[], r: number) {
  const n = members.length;
  const c = n > 1 ? (r - 14) / Math.sqrt(n - 0.5) : 0;
  return members.map((a, i) => {
    const rad = n === 1 ? 0 : c * Math.sqrt(i + 0.5);
    const ang = i * GOLDEN;
    return { a, dx: Math.cos(ang) * rad, dy: Math.sin(ang) * rad + (n === 1 ? -4 : 0) };
  });
}

function relax(nodes: Node[], links: Link[], steps: number, gap: number) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (let s = 0; s < steps; s++) {
    tick(nodes, links, byId, 1, gap);
  }
}

function tick(nodes: Node[], links: Link[], byId: Map<string, Node>, alpha: number, gap: number) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const m = nodes[j]!;
      let dx = m.x - n.x;
      let dy = m.y - n.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.01) {
        dx = 0.5;
        dy = 0.3;
        d = 0.6;
      }
      const minD = n.r + m.r + gap;
      let push = 400 / (d * d);
      if (d < minD) push += (minD - d) * 0.5;
      const fx = (dx / d) * push;
      const fy = (dy / d) * push;
      n.vx -= fx;
      n.vy -= fy;
      m.vx += fx;
      m.vy += fy;
    }
  }
  for (const l of links) {
    const s = byId.get(l.s);
    const t = byId.get(l.t);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - l.len) * l.k;
    s.vx += (dx / d) * f;
    s.vy += (dy / d) * f;
    t.vx -= (dx / d) * f;
    t.vy -= (dy / d) * f;
  }
  for (const n of nodes) {
    n.vx -= n.x * 0.01;
    n.vy -= n.y * 0.014;
    if (n.fixed) {
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx *= 0.55;
    n.vy *= 0.55;
    n.x += n.vx * alpha;
    n.y += n.vy * alpha;
  }
}

function build(agents: MapAgent[], mode: 'tecnologia' | 'datos'): { nodes: Node[]; links: Link[]; gap: number } {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const platforms = [...new Set(agents.map((a) => a.platform))];
  if (mode === 'tecnologia') {
    // Una burbuja por plataforma, agentes adentro; las del mismo proveedor se atraen.
    platforms
      .map((p) => agents.filter((a) => a.platform === p))
      .sort((x, y) => x[0]!.vendor.localeCompare(y[0]!.vendor) || y.length - x.length)
      .forEach((members, i, all) => {
        const ang = (i / all.length) * Math.PI * 2;
        nodes.push({
          id: `p:${members[0]!.platform}`,
          kind: 'platform',
          label: members[0]!.platformName,
          sub: members[0]!.vendor,
          r: 24 + Math.sqrt(members.length) * 15,
          x: Math.cos(ang) * 220,
          y: Math.sin(ang) * 150,
          vx: 0,
          vy: 0,
          members,
        });
      });
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        if (nodes[i]!.sub === nodes[j]!.sub) links.push({ s: nodes[i]!.id, t: nodes[j]!.id, len: nodes[i]!.r + nodes[j]!.r + 22, k: 0.05 });
    return { nodes, links, gap: 48 };
  }
  // Red: agentes al centro de sus plataformas y unidos a las fuentes de datos que usan.
  platforms.forEach((p, i) => {
    const ang = (i / platforms.length) * Math.PI * 2;
    const members = agents.filter((a) => a.platform === p);
    nodes.push({ id: `p:${p}`, kind: 'platform', label: members[0]!.platformName, sub: members[0]!.vendor, r: 13, x: Math.cos(ang) * 300, y: Math.sin(ang) * 210, vx: 0, vy: 0, members });
  });
  agents.forEach((a, i) => {
    const pl = nodes.find((n) => n.id === `p:${a.platform}`)!;
    nodes.push({ id: a.id, kind: 'agent', label: a.name, r: dotR(a), x: pl.x * 0.7 + ((i * 37) % 40) - 20, y: pl.y * 0.7 + ((i * 53) % 40) - 20, vx: 0, vy: 0, agent: a });
    links.push({ s: a.id, t: `p:${a.platform}`, len: 46, k: 0.08 });
  });
  const sources = [...new Set(agents.flatMap((a) => a.dataSources))];
  sources.forEach((d, i) => {
    const ang = (i / Math.max(1, sources.length)) * Math.PI * 2;
    nodes.push({ id: `d:${d}`, kind: 'data', label: d, r: 9, x: Math.cos(ang) * 120, y: Math.sin(ang) * 90, vx: 0, vy: 0 });
  });
  for (const a of agents) for (const d of a.dataSources) links.push({ s: a.id, t: `d:${d}`, len: 80, k: 0.03 });
  return { nodes, links, gap: 26 };
}

/** Mapa de agentes: burbujas por plataforma (como el centro de administración de Microsoft 365) o red de agentes y datos. */
export function AgentMap({ agents, highlight }: { agents: MapAgent[]; highlight: string[] | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'tecnologia' | 'datos'>('tecnologia');
  const [, setTick] = useState(0);
  const [hover, setHover] = useState<{ title: string; lines: string[] } | null>(null);
  const graph = useMemo(() => {
    const g = build(agents, mode);
    relax(g.nodes, g.links, 320, g.gap);
    return g;
  }, [agents, mode]);
  const fit = useMemo(() => {
    const xs = graph.nodes.flatMap((n) => [n.x - n.r, n.x + n.r]);
    const ys = graph.nodes.flatMap((n) => [n.y - n.r - 6, n.y + n.r + (n.kind === 'platform' ? 34 : 16)]);
    const w = Math.max(...xs) - Math.min(...xs) + 40;
    const h = Math.max(...ys) - Math.min(...ys) + 40;
    const k = Math.min(1.6, VB_W / w, VB_H / h);
    return { k, x: -((Math.max(...xs) + Math.min(...xs)) / 2) * k, y: -((Math.max(...ys) + Math.min(...ys)) / 2) * k };
  }, [graph]);
  const [view, setView] = useState(fit);
  useEffect(() => setView(fit), [fit]);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ node: Node | null; agentId: string | null; panX: number; panY: number; sx: number; sy: number; moved: boolean } | null>(null);
  const anim = useRef(0);
  const hl = highlight ? new Set(highlight) : null;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // Al arrastrar, el resto se acomoda unos instantes.
  const reheat = () => {
    cancelAnimationFrame(anim.current);
    let alpha = 0.6;
    const loop = () => {
      tick(graph.nodes, graph.links, byId, alpha, graph.gap);
      alpha *= 0.94;
      setTick((t) => t + 1);
      if (alpha > 0.03) anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);
  };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const toWorld = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((cx - r.left) / r.width) * VB_W - VB_W / 2;
    const sy = ((cy - r.top) / r.height) * VB_H - VB_H / 2;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
  };
  const open = (id: string) => {
    const hit = agents.find((x) => x.id === id);
    if (hit?.fromInventory && hit.useCaseId) {
      router.push(`/inventario?caso=${hit.useCaseId}`);
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.set('agente', id);
    router.push(`/agentes?${next.toString()}`, { scroll: false });
  };
  const agentTip = (a: MapAgent) => ({
    title: a.name,
    lines: [
      `${a.platformName} · riesgo ${a.risk} · ${a.status}`,
      `${a.ownerName ? `Dueño: ${a.ownerName}` : 'Sin dueño'}${a.managed ? '' : ' · no gestionado'}`,
      a.fromInventory ? 'Caso en producción del inventario sin agente registrado' : `${a.monthlyUsers.toLocaleString('es-MX')} usuarios al mes`,
    ],
  });
  const platformDim = (n: Node) => hl && !(n.members ?? []).some((a) => hl.has(a.id));

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 z-10 flex rounded-lg border border-border bg-surface p-0.5 text-[12px] shadow-sm">
        {(
          [
            ['tecnologia', 'Por tecnología'],
            ['datos', 'Agentes y datos'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-md px-2.5 py-1 transition ${mode === k ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <button type="button" aria-label="Acercar" className="p-1.5 text-ink-muted hover:text-ink" onClick={() => setView((v) => ({ ...v, k: Math.min(4, v.k * 1.25) }))}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Alejar" className="border-t border-border p-1.5 text-ink-muted hover:text-ink" onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.25) }))}>
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Ajustar a la vista" className="border-t border-border p-1.5 text-ink-muted hover:text-ink" onClick={() => setView(fit)}>
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${-VB_W / 2} ${-VB_H / 2} ${VB_W} ${VB_H}`}
        className="aspect-[9/7] h-auto w-full cursor-grab sm:aspect-auto sm:h-[540px] touch-none select-none rounded-xl bg-canvas-subtle/50 active:cursor-grabbing"
        role="img"
        aria-label={`Mapa de ${agents.length} agentes en ${new Set(agents.map((a) => a.platform)).size} plataformas`}
        onWheel={(e) => {
          const k = Math.min(4, Math.max(0.3, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
          setView((v) => ({ ...v, k }));
        }}
        onPointerDown={(e) => {
          const el = e.target as SVGElement;
          const agentEl = el.closest('[data-agent]') as SVGElement | null;
          const nodeEl = el.closest('[data-node]') as SVGElement | null;
          const node = nodeEl ? byId.get(nodeEl.dataset.node!) ?? null : null;
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          drag.current = { node, agentId: agentEl?.dataset.agent ?? null, panX: view.x, panY: view.y, sx: e.clientX, sy: e.clientY, moved: false };
          if (node) node.fixed = true;
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
          if (!d.moved) return;
          if (d.node) {
            const w = toWorld(e.clientX, e.clientY);
            d.node.x = w.x;
            d.node.y = w.y;
            reheat();
          } else {
            const r = svgRef.current!.getBoundingClientRect();
            setView((v) => ({ ...v, x: d.panX + ((e.clientX - d.sx) / r.width) * VB_W, y: d.panY + ((e.clientY - d.sy) / r.height) * VB_H }));
          }
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.node) d.node.fixed = false;
          if (d && !d.moved && d.agentId) open(d.agentId);
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {graph.links.map((l, i) => {
            const s = byId.get(l.s)!;
            const t = byId.get(l.t)!;
            if (mode === 'tecnologia') return null;
            const faded = hl && !((s.agent && hl.has(s.agent.id)) || (t.agent && hl.has(t.agent.id)));
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={t.kind === 'data' ? 'var(--onix-accent)' : 'var(--onix-border-strong)'}
                strokeOpacity={faded ? 0.08 : t.kind === 'data' ? 0.35 : 0.6}
                strokeWidth={1}
              />
            );
          })}

          {graph.nodes.map((n) => {
            if (n.kind === 'platform' && mode === 'tecnologia') {
              const faded = platformDim(n);
              return (
                <g key={n.id} data-node={n.id} opacity={faded ? 0.3 : 1}>
                  <circle cx={n.x} cy={n.y} r={n.r} fill="var(--onix-surface)" stroke="var(--onix-border-strong)" strokeWidth={1.2} />
                  <circle cx={n.x} cy={n.y} r={n.r - 4} fill="color-mix(in srgb, var(--onix-accent) 5%, transparent)" />
                  {packInside(n.members!, n.r).map(({ a, dx, dy }) => {
                    const isHl = hl?.has(a.id);
                    const rr = dotR(a);
                    return (
                      <g
                        key={a.id}
                        data-agent={a.id}
                        className="cursor-pointer"
                        opacity={hl && !isHl ? 0.25 : 1}
                        onPointerEnter={() => setHover(agentTip(a))}
                        onPointerLeave={() => setHover(null)}
                      >
                        {isHl ? <circle cx={n.x + dx} cy={n.y + dy} r={rr + 4} fill="none" stroke="var(--onix-accent)" strokeWidth={2} /> : null}
                        <circle
                          cx={n.x + dx}
                          cy={n.y + dy}
                          r={rr}
                          fill={a.fromInventory ? 'var(--onix-surface)' : RISK_FILL[a.risk] ?? 'var(--onix-accent)'}
                          stroke={a.fromInventory ? RISK_FILL[a.risk] ?? 'var(--onix-accent)' : a.managed ? 'var(--onix-surface)' : 'var(--onix-text)'}
                          strokeWidth={a.fromInventory ? 2.5 : a.managed ? 2 : 1.4}
                          strokeDasharray={a.managed ? undefined : '2.5 2'}
                          opacity={a.status === 'Inactivo' || a.status === 'Bloqueado' ? 0.4 : 1}
                        />
                      </g>
                    );
                  })}
                  <text x={n.x} y={n.y + n.r + 15} fontSize={11.5} fontWeight={600} fill="var(--onix-text)" textAnchor="middle">
                    {n.label} <tspan fill="var(--onix-text-subtle)" fontWeight={400}>({n.members!.length})</tspan>
                  </text>
                  <text x={n.x} y={n.y + n.r + 28} fontSize={10} fill="var(--onix-text-subtle)" textAnchor="middle">
                    {n.sub}
                  </text>
                </g>
              );
            }
            if (n.kind === 'platform') {
              const faded = platformDim(n);
              return (
                <g key={n.id} data-node={n.id} opacity={faded ? 0.3 : 1} onPointerEnter={() => setHover({ title: n.label, lines: [`${n.members!.length} agentes · ${n.sub}`] })} onPointerLeave={() => setHover(null)}>
                  <circle cx={n.x} cy={n.y} r={n.r} fill="var(--onix-surface)" stroke="var(--onix-text-muted)" strokeWidth={1.4} />
                  <text x={n.x} y={n.y + 3.5} fontSize={9} fontWeight={700} fill="var(--onix-text)" textAnchor="middle">
                    {initials(n.label)}
                  </text>
                  <text x={n.x} y={n.y + n.r + 11} fontSize={10} fill="var(--onix-text-muted)" textAnchor="middle">
                    {n.label}
                  </text>
                </g>
              );
            }
            if (n.kind === 'data') {
              const faded = hl && !agents.some((a) => hl.has(a.id) && a.dataSources.includes(n.label));
              return (
                <g key={n.id} data-node={n.id} opacity={faded ? 0.2 : 1} onPointerEnter={() => setHover({ title: n.label, lines: [`Fuente de datos · la usan ${agents.filter((a) => a.dataSources.includes(n.label)).length} agentes`] })} onPointerLeave={() => setHover(null)}>
                  <rect x={n.x - 6} y={n.y - 6} width={12} height={12} rx={3} fill="var(--onix-surface)" stroke="var(--onix-accent)" strokeWidth={1.4} />
                  {view.k > fit.k * 1.5 || (hl && !faded) || agents.filter((a) => a.dataSources.includes(n.label)).length >= 3 ? (
                    <text x={n.x} y={n.y + 18} fontSize={9.5} fill="var(--onix-text-muted)" textAnchor="middle">
                      {n.label}
                    </text>
                  ) : null}
                </g>
              );
            }
            const a = n.agent!;
            const isHl = hl?.has(a.id);
            return (
              <g key={n.id} data-node={n.id} data-agent={a.id} className="cursor-pointer" opacity={hl && !isHl ? 0.2 : 1} onPointerEnter={() => setHover(agentTip(a))} onPointerLeave={() => setHover(null)}>
                {isHl ? <circle cx={n.x} cy={n.y} r={n.r + 4} fill="none" stroke="var(--onix-accent)" strokeWidth={2} /> : null}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={a.fromInventory ? 'var(--onix-surface)' : RISK_FILL[a.risk] ?? 'var(--onix-accent)'}
                  stroke={a.fromInventory ? RISK_FILL[a.risk] ?? 'var(--onix-accent)' : a.managed ? 'var(--onix-surface)' : 'var(--onix-text)'}
                  strokeWidth={a.fromInventory ? 2.5 : a.managed ? 2 : 1.4}
                  strokeDasharray={a.managed ? undefined : '2.5 2'}
                />
                {view.k > fit.k * 1.8 || isHl ? (
                  <text x={n.x} y={n.y - n.r - 4} fontSize={9.5} fill="var(--onix-text)" textAnchor="middle">
                    {a.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {hover ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[300px] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-md">
          <p className="font-medium text-ink">{hover.title}</p>
          {hover.lines.map((l) => (
            <p key={l} className="text-ink-muted">
              {l}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-muted">
        <span className="text-ink-subtle">Color = riesgo:</span>
        {Object.entries(RISK_FILL).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {k}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-ink" />
          No gestionado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-accent" />
          Caso del inventario sin agente
        </span>
        <span className="text-ink-subtle">Arrastra las burbujas, acerca con la rueda y toca un agente para ver su ficha.</span>
      </div>
    </div>
  );
}
