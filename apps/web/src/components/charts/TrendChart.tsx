'use client';

import { useState } from 'react';

export interface TrendSeries {
  name: string;
  values: number[];
  /** solid = serie principal (acento), muted = comparación (gris, punteada) */
  tone: 'solid' | 'muted';
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)} mil` : String(Math.round(n)));

/** Línea por periodo, un solo eje, con cruceta y tooltip al pasar el cursor. */
export function TrendChart({
  labels,
  series,
  unit,
  height = 220,
  kind = 'number',
  width = 640,
}: {
  labels: string[];
  series: TrendSeries[];
  unit?: string;
  height?: number;
  /** number = 12 mil; mxn = $12,000 */
  kind?: 'number' | 'mxn';
  /** ancho lógico del dibujo; más chico = letra más grande en tarjetas angostas */
  width?: number;
}) {
  const format = kind === 'mxn' ? (n: number) => (n >= 1000 ? `$${Math.round(n / 1000).toLocaleString('es-MX')} mil` : `$${Math.round(n)}`) : fmt;
  const [hover, setHover] = useState<number | null>(null);
  const W = width;
  const H = height;
  const m = { l: 44, r: 16, t: 14, b: 26 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  })();
  const X = (i: number) => m.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const Y = (v: number) => m.t + ih - (v / nice) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={series.map((s) => `${s.name}: ${s.values.map(format).join(', ')}`).join('. ')}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((x - m.l) / iw) * (labels.length - 1));
          setHover(i >= 0 && i < labels.length ? i : null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="var(--onix-chart-grid)" strokeWidth={1} />
            <text x={m.l - 8} y={Y(t) + 3.5} fontSize={10} fill="var(--onix-text-subtle)" textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={X(i)} y={H - 8} fontSize={10} fill="var(--onix-text-subtle)" textAnchor="middle">
            {l}
          </text>
        ))}
        {hover != null ? <line x1={X(hover)} x2={X(hover)} y1={m.t} y2={m.t + ih} stroke="var(--onix-border-strong)" strokeWidth={1} /> : null}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}
              fill="none"
              stroke={s.tone === 'solid' ? 'var(--onix-accent)' : 'var(--onix-chart-neutral)'}
              strokeWidth={2}
              strokeDasharray={s.tone === 'muted' ? '5 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) =>
              hover === i || i === s.values.length - 1 ? (
                <circle
                  key={i}
                  cx={X(i)}
                  cy={Y(v)}
                  r={4}
                  fill={s.tone === 'solid' ? 'var(--onix-accent)' : 'var(--onix-chart-neutral)'}
                  stroke="var(--onix-surface)"
                  strokeWidth={2}
                />
              ) : null,
            )}
          </g>
        ))}
      </svg>
      {hover != null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[150px] -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-md"
          style={{ left: `${(X(hover) / W) * 100}%` }}
        >
          <p className="font-medium text-ink">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="mt-0.5 flex items-center justify-between gap-3 text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-3"
                  style={{ background: s.tone === 'solid' ? 'var(--onix-accent)' : 'var(--onix-chart-neutral)' }}
                />
                {s.name}
              </span>
              <span className="tabular-nums text-ink">
                {format(s.values[hover] ?? 0)}
                {unit ? ` ${unit}` : ''}
              </span>
            </p>
          ))}
        </div>
      ) : null}
      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-ink-muted">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3" stroke={s.tone === 'solid' ? 'var(--onix-accent)' : 'var(--onix-chart-neutral)'} strokeWidth="2" strokeDasharray={s.tone === 'muted' ? '4 3' : undefined} />
              </svg>
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
