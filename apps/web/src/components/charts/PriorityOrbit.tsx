'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface OrbitCase {
  id: string;
  name: string;
  score: number;
  quadrant: string;
  risk: string;
  annualValue: number | null;
  valueAxis: number;
  feasibilityAxis: number;
  rank: number;
  criteria: { n: string; v: number }[];
}

const SECTORS = [
  { q: 'Apuestas prioritarias', from: -90, to: 0, hint: 'Hacer ya' },
  { q: 'Ganancias rápidas', from: 0, to: 90, hint: 'Aprovechar' },
  { q: 'Revisar o pausar', from: 90, to: 180, hint: 'No invertir por ahora' },
  { q: 'Proyectos estratégicos', from: 180, to: 270, hint: 'Preparar datos y equipo' },
] as const;

const RISK: Record<string, string> = {
  Bajo: 'var(--onix-chart-neutral)',
  Medio: 'var(--onix-accent)',
  Alto: 'var(--onix-warning)',
  Inaceptable: 'var(--onix-danger)',
};

const S = 700;
const C = S / 2;
const R = 236;
/** Radio por puntaje: 100 al centro, 40 o menos en el borde. */
const rOf = (score: number) => 30 + Math.min(1, Math.max(0, (100 - score) / 60)) * (R - 52);
const rad = (deg: number) => (deg * Math.PI) / 180;
const pol = (r: number, deg: number) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))] as const;

function arc(r: number, from: number, to: number) {
  const [x1, y1] = pol(r, from);
  const [x2, y2] = pol(r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/**
 * Órbita de prioridad: entre más cerca del centro, más prioridad (puntaje 0 a 100).
 * El sector dice qué tipo de decisión es; el tamaño, el valor anual; el color, el riesgo.
 */
export function PriorityOrbit({ cases }: { cases: OrbitCase[] }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const maxValue = Math.max(1, ...cases.map((c) => c.annualValue ?? 0));
  const placed = SECTORS.flatMap((s) => {
    const list = cases.filter((c) => c.quadrant === s.q).sort((a, b) => b.score - a.score);
    return list.map((c, i) => {
      const span = s.to - s.from;
      const ang = s.from + (span * (i + 1)) / (list.length + 1) + (i % 2 ? 6 : -6) * (list.length > 3 ? 1 : 0);
      const r = rOf(c.score);
      const size = 9 + Math.sqrt((c.annualValue ?? maxValue * 0.15) / maxValue) * 15;
      const [x, y] = pol(r, ang);
      return { c, x, y, size, ang } as { c: OrbitCase; x: number; y: number; size: number; ang: number };
    });
  });
  // Separa burbujas que se encimen, conservando su dirección general.
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.size + b.size + 5;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
  }
  const h = placed.find((p) => p.c.id === hover) ?? null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block h-auto w-full max-w-[660px]" role="img" aria-label="Órbita de prioridad de los casos de IA">
        <defs>
          <radialGradient id="orbit-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--onix-accent)" stopOpacity="0.28" />
            <stop offset="45%" stopColor="var(--onix-accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--onix-accent)" stopOpacity="0" />
          </radialGradient>
          <filter id="orbit-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={C} cy={C} r={R} fill="url(#orbit-core)" />
        {/* Anillos de puntaje */}
        {[90, 80, 70, 60, 50].map((sc) => {
          const r = rOf(sc);
          return (
            <g key={sc}>
              <circle cx={C} cy={C} r={r} fill="none" stroke="var(--onix-accent)" strokeOpacity={0.16} strokeDasharray="2 5" />
              <text x={C + 4} y={C - r - 3} fontSize={9} fill="var(--onix-text-subtle)">
                {sc}
              </text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--onix-border-strong)" strokeOpacity={0.6} />
        <g className="onix-orbit-spin" style={{ transformOrigin: `${C}px ${C}px` }}>
          <circle cx={C} cy={C} r={R + 8} fill="none" stroke="var(--onix-accent)" strokeOpacity={0.35} strokeDasharray="1 9" strokeWidth={2} strokeLinecap="round" />
        </g>
        {/* Sectores */}
        {SECTORS.map((s) => {
          const [x1, y1] = pol(R, s.from);
          const mid = (s.from + s.to) / 2;
          const [lx, ly] = pol(R + 26, mid);
          const anchor = Math.cos(rad(mid)) > 0.2 ? 'start' : Math.cos(rad(mid)) < -0.2 ? 'end' : 'middle';
          const top = s.q === 'Apuestas prioritarias';
          return (
            <g key={s.q}>
              <line x1={C} y1={C} x2={x1} y2={y1} stroke="var(--onix-border-strong)" strokeOpacity={0.5} />
              {top ? <path d={arc(R - 2, s.from + 1, s.to - 1)} fill="none" stroke="var(--onix-accent)" strokeWidth={3} strokeLinecap="round" strokeOpacity={0.7} /> : null}
              <text x={lx} y={ly - 4} fontSize={12} fontWeight={600} fill={top ? 'var(--onix-accent)' : 'var(--onix-text)'} textAnchor={anchor}>
                {s.q}
              </text>
              <text x={lx} y={ly + 10} fontSize={10} fill="var(--onix-text-subtle)" textAnchor={anchor}>
                {s.hint}
              </text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={4} fill="var(--onix-accent)" />

        {/* Casos */}
        {placed.map(({ c, x, y, size }, i) => {
          const dim = hover && hover !== c.id;
          const top3 = c.rank <= 3;
          return (
            <g
              key={c.id}
              className="cursor-pointer"
              style={{
                transform: ready ? `translate(0px, 0px)` : `translate(${C - x}px, ${C - y}px) scale(0.2)`,
                transformOrigin: `${x}px ${y}px`,
                transition: `transform 900ms cubic-bezier(.2,.8,.2,1) ${i * 60}ms, opacity 200ms`,
                opacity: dim ? 0.3 : 1,
              }}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/inventario?caso=${c.id}`)}
            >
              <line x1={C} y1={C} x2={x} y2={y} stroke="var(--onix-accent)" strokeOpacity={hover === c.id ? 0.5 : 0.08} />
              {top3 ? <circle cx={x} cy={y} r={size + 7} fill="var(--onix-accent)" opacity={0.18} filter="url(#orbit-glow)" /> : null}
              <circle cx={x} cy={y} r={size} fill={RISK[c.risk] ?? 'var(--onix-accent)'} fillOpacity={0.9} stroke="var(--onix-surface)" strokeWidth={2} />
              <text x={x} y={y + 3.8} fontSize={11} fontWeight={700} textAnchor="middle" fill="#fff">
                {c.rank}
              </text>
            </g>
          );
        })}
      </svg>

      {h ? (
        <div className="onix-glass pointer-events-none absolute left-3 top-3 z-10 w-[250px] rounded-xl px-3.5 py-3 text-[12px] shadow-md">
          <p className="text-[13px] font-semibold text-ink">
            {h.c.rank}. {h.c.name}
          </p>
          <p className="mt-0.5 text-ink-muted">
            Puntaje {h.c.score} · {h.c.quadrant} · riesgo {h.c.risk}
          </p>
          <div className="mt-2 space-y-1">
            {h.c.criteria.map((k) => (
              <div key={k.n} className="flex items-center gap-2">
                <span className="w-[108px] shrink-0 truncate text-[11px] text-ink-muted">{k.n}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-subtle">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(k.v / 5) * 100}%` }} />
                </span>
                <span className="w-6 text-right text-[11px] tabular-nums text-ink">{k.v.toFixed(1)}</span>
              </div>
            ))}
          </div>
          {h.c.annualValue ? <p className="mt-2 text-ink-subtle">Valor anual estimado ${h.c.annualValue.toLocaleString('es-MX')} MXN</p> : null}
        </div>
      ) : null}
    </div>
  );
}
