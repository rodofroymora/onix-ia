'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';

export interface LineageAction {
  id: string;
  title: string;
  stageId: string;
  dimension: string;
  progress: number;
  dueLabel: string;
  late: boolean;
  critical: boolean;
  evidence: string | null;
  href: string;
}
export interface LineageStage {
  id: string;
  name: string;
  window: string;
  pct: number;
}
export interface LineageDep {
  id: string;
  from: string;
  to: string;
  weight: number;
}

type Edge = { dep: LineageDep; x1: number; y1: number; x2: number; y2: number; dir: 'up' | 'down' };

/**
 * Tablero por etapas con linaje: al tocar una acción se dibujan sus dependencias
 * (de qué depende y a qué impacta) con el porcentaje de dependencia.
 */
export function PlanLineage({ stages, actions, deps }: { stages: LineageStage[]; actions: LineageAction[]; deps: LineageDep[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  const upstream = sel ? deps.filter((d) => d.to === sel) : [];
  const downstream = sel ? deps.filter((d) => d.from === sel) : [];
  const related = new Set([sel, ...upstream.map((d) => d.from), ...downstream.map((d) => d.to)].filter(Boolean) as string[]);
  const byId = new Map(actions.map((a) => [a.id, a]));

  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || !sel) {
      setEdges([]);
      return;
    }
    const pos = (id: string) => cards.current.get(id)?.getBoundingClientRect();
    const out: Edge[] = [];
    for (const [list, dir] of [
      [upstream, 'up'],
      [downstream, 'down'],
    ] as const) {
      for (const d of list) {
        const a = pos(d.from);
        const b = pos(d.to);
        if (!a || !b) continue;
        // Del borde derecho del prerrequisito al izquierdo de la dependiente (o vertical si están en la misma columna).
        const sameCol = Math.abs(a.left - b.left) < 10;
        const x1 = sameCol ? a.left + a.width - 14 - box.left : (a.left < b.left ? a.right : a.left) - box.left;
        const y1 = sameCol ? (a.top < b.top ? a.bottom : a.top) - box.top : a.top + a.height / 2 - box.top;
        const x2 = sameCol ? b.left + b.width - 14 - box.left : (a.left < b.left ? b.left : b.right) - box.left;
        const y2 = sameCol ? (a.top < b.top ? b.top : b.bottom) - box.top : b.top + b.height / 2 - box.top;
        out.push({ dep: d, x1, y1, x2, y2, dir });
      }
    }
    setEdges(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, deps]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const path = (e: Edge) => {
    const dx = Math.max(40, Math.abs(e.x2 - e.x1) / 2);
    const vertical = Math.abs(e.x2 - e.x1) < 30;
    if (vertical) {
      const off = 26;
      return `M ${e.x1} ${e.y1} C ${e.x1 + off} ${e.y1 + (e.y2 - e.y1) / 3}, ${e.x2 + off} ${e.y2 - (e.y2 - e.y1) / 3}, ${e.x2} ${e.y2}`;
    }
    const sgn = e.x2 > e.x1 ? 1 : -1;
    return `M ${e.x1} ${e.y1} C ${e.x1 + dx * sgn} ${e.y1}, ${e.x2 - dx * sgn} ${e.y2}, ${e.x2} ${e.y2}`;
  };

  const selected = sel ? byId.get(sel) : null;
  const risk = (list: LineageDep[], key: 'from' | 'to') =>
    list.filter((d) => (byId.get(d[key])?.progress ?? 100) < 100).reduce((t, d) => Math.max(t, d.weight), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-muted">
        <span>Toca una acción para ver de qué depende y a qué impacta.</span>
        <span className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--onix-accent)" strokeWidth="2" />
            </svg>
            Depende de
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--onix-text-muted)" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Impacta a
          </span>
        </span>
      </div>

      {selected ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink">{selected.title}</p>
            <div className="mt-1.5 grid gap-x-8 gap-y-1 text-[12px] text-ink-muted sm:grid-cols-2">
              <div>
                <p className="text-ink-subtle">Depende de</p>
                {upstream.length ? (
                  upstream.map((d) => (
                    <p key={d.id}>
                      <span className="tabular-nums text-ink">{d.weight}%</span> · {byId.get(d.from)?.title}{' '}
                      <span className="text-ink-subtle">({byId.get(d.from)?.progress}% de avance)</span>
                    </p>
                  ))
                ) : (
                  <p>Nada; puede arrancar ya.</p>
                )}
              </div>
              <div>
                <p className="text-ink-subtle">Impacta a</p>
                {downstream.length ? (
                  downstream.map((d) => (
                    <p key={d.id}>
                      <span className="tabular-nums text-ink">{d.weight}%</span> · {byId.get(d.to)?.title}
                    </p>
                  ))
                ) : (
                  <p>Ninguna otra acción.</p>
                )}
              </div>
            </div>
            {risk(upstream, 'from') >= 60 ? (
              <p className="mt-2 text-[12px] text-warning">Bloqueo probable: depende en {risk(upstream, 'from')}% de una acción que no ha cerrado.</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link href={selected.href} className="onix-btn-ghost py-1.5">
              Abrir y editar <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <button type="button" aria-label="Quitar selección" onClick={() => setSel(null)} className="rounded-md p-1.5 text-ink-subtle hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div ref={wrap} className="relative">
        <div className="grid gap-4 lg:grid-cols-3">
          {stages.map((s) => (
            <section key={s.id} className="rounded-xl bg-canvas-subtle/70 p-3">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <p className="text-[13px] font-medium text-ink">
                  {s.name} <span className="text-ink-subtle">· {s.window}</span>
                </p>
                <span className="text-[12px] tabular-nums text-ink-muted">{s.pct}%</span>
              </div>
              <div className="space-y-2">
                {actions
                  .filter((a) => a.stageId === s.id)
                  .map((a) => {
                    const isSel = sel === a.id;
                    const faded = sel && !related.has(a.id);
                    const nDeps = deps.filter((d) => d.to === a.id || d.from === a.id).length;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        ref={(el) => {
                          if (el) cards.current.set(a.id, el);
                          else cards.current.delete(a.id);
                        }}
                        onClick={() => setSel(isSel ? null : a.id)}
                        onDoubleClick={() => (window.location.href = a.href)}
                        className={`block w-full rounded-lg border bg-surface px-3.5 py-3 text-left transition ${
                          isSel ? 'border-accent ring-2 ring-[color-mix(in_srgb,var(--onix-accent)_25%,transparent)]' : 'border-border hover:border-border-strong'
                        } ${faded ? 'opacity-35' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] leading-snug text-ink">{a.title}</p>
                          {a.critical ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" title="Crítica" /> : null}
                        </div>
                        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-canvas-subtle">
                          <div className="h-full bg-accent" style={{ width: `${a.progress}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-subtle">
                          <span className="truncate">
                            {a.dimension}
                            {nDeps ? ` · ${nDeps} ${nDeps === 1 ? 'vínculo' : 'vínculos'}` : ''}
                          </span>
                          <span className={`shrink-0 ${a.late ? 'text-danger' : ''}`}>
                            {a.progress}% · {a.dueLabel}
                            {a.evidence ? ` · ${a.evidence}` : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>

        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <marker id="arr-up" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M2,1.5 L8,5 L2,8.5" fill="none" stroke="var(--onix-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="arr-down" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M2,1.5 L8,5 L2,8.5" fill="none" stroke="var(--onix-text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {edges.map((e) => {
            const mx = (e.x1 + e.x2) / 2 + (Math.abs(e.x2 - e.x1) < 30 ? 22 : 0);
            const my = (e.y1 + e.y2) / 2;
            const color = e.dir === 'up' ? 'var(--onix-accent)' : 'var(--onix-text-muted)';
            return (
              <g key={e.dep.id}>
                <path
                  d={path(e)}
                  fill="none"
                  stroke={color}
                  strokeWidth={1 + e.dep.weight / 80}
                  strokeDasharray={e.dir === 'down' ? '5 4' : undefined}
                  markerEnd={`url(#arr-${e.dir})`}
                />
                <g transform={`translate(${mx} ${my})`}>
                  <rect x={-18} y={-10} width={36} height={20} rx={10} fill="var(--onix-surface)" stroke={color} strokeWidth={1} />
                  <text y={4} fontSize={11} fontWeight={600} textAnchor="middle" fill="var(--onix-text)">
                    {e.dep.weight}%
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
