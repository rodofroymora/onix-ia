/**
 * Gráficas en SVG, renderizadas en el servidor. Monocromas en la escala del acento,
 * con etiquetas directas y sin leyendas innecesarias.
 */

const C = {
  accent: 'var(--onix-accent)',
  grid: 'var(--onix-chart-grid)',
  neutral: 'var(--onix-chart-neutral)',
  text: 'var(--onix-text)',
  muted: 'var(--onix-text-muted)',
  subtle: 'var(--onix-text-subtle)',
  surface: 'var(--onix-surface)',
};

/* ---------------------------------------------------------------- Radar */

export interface RadarSeries {
  name: string;
  values: number[]; // 0 a 100
  style: 'solid' | 'outline' | 'dashed';
}

export function RadarChart({
  axes,
  series,
  size = 300,
}: {
  axes: { label: string[] }[];
  series: RadarSeries[];
  size?: number;
}) {
  const pad = 96;
  const w = size + pad * 2;
  const cx = w / 2;
  const h = size + 56 * 2;
  const cy = h / 2;
  const r = size / 2;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * (v / 100), cy + Math.sin(a) * r * (v / 100)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, Math.max(0, Math.min(100, v))).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto h-auto w-full max-w-[560px]" role="img" aria-label="Radar de madurez por dimensión">
      {[25, 50, 75, 100].map((g) => (
        <polygon key={g} points={poly(Array(n).fill(g))} fill="none" stroke={C.grid} strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.grid} strokeWidth={1} />;
      })}
      {[25, 50, 75].map((g) => {
        const [x, y] = pt(0, g);
        return (
          <text key={g} x={x - 4} y={y - 3} fontSize={9} fill={C.subtle} textAnchor="end" opacity={0.8}>
            {g}
          </text>
        );
      })}
      {series.map((s) => (
        <polygon
          key={s.name}
          points={poly(s.values)}
          fill={s.style === 'solid' ? 'color-mix(in srgb, var(--onix-accent) 16%, transparent)' : 'none'}
          stroke={s.style === 'solid' ? C.accent : s.style === 'dashed' ? C.neutral : C.accent}
          strokeOpacity={s.style === 'outline' ? 0.45 : 1}
          strokeWidth={s.style === 'solid' ? 2 : 1.5}
          strokeDasharray={s.style === 'dashed' ? '4 4' : undefined}
          strokeLinejoin="round"
        />
      ))}
      {series
        .filter((s) => s.style === 'solid')
        .map((s) =>
          s.values.map((v, i) => {
            const [x, y] = pt(i, v);
            return <circle key={`${s.name}-${i}`} cx={x} cy={y} r={3} fill={C.accent} />;
          }),
        )}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 118);
        const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
        return (
          <text key={i} x={x} y={y - (a.label.length - 1) * 6} fontSize={11} fill={C.muted} textAnchor={anchor}>
            {a.label.map((line, j) => (
              <tspan key={j} x={x} dy={j === 0 ? 0 : 13}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

export function SeriesKey({ items }: { items: { label: string; style: RadarSeries['style'] }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-[11px] text-ink-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              stroke={i.style === 'dashed' ? C.neutral : C.accent}
              strokeOpacity={i.style === 'outline' ? 0.45 : 1}
              strokeWidth={2}
              strokeDasharray={i.style === 'dashed' ? '3 3' : undefined}
            />
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Barras con meta */

export function MeterRow({
  label,
  value,
  projected,
  target,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  projected?: number | null;
  target?: number | null;
  suffix?: string;
  hint?: string;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] text-ink">{label}</span>
        <span className="shrink-0 text-[12px] tabular-nums text-ink-muted">
          <span className="text-ink">{Math.round(value)}</span>
          {projected != null && projected > value ? <> → {Math.round(projected)}</> : null}
          {target != null ? <span className="text-ink-subtle"> / meta {target}</span> : null}
          {suffix ?? ''}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-canvas-subtle">
        {projected != null && projected > value ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${clamp(projected)}%`, background: 'var(--onix-chart-2)' }}
          />
        ) : null}
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${clamp(value)}%` }} />
        {target != null ? (
          <div
            className="absolute -top-1 h-3.5 w-px bg-ink"
            style={{ left: `${clamp(target)}%` }}
            title={`Meta ${target}`}
          />
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Anillo */

export function Ring({ value, size = 72, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${v}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--onix-bg-subtle)" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={C.accent}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${(c * v) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.22} fontWeight={600} fill={C.text}>
        {Math.round(v)}%
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------- Distribución apilada */

export function StackBar({
  parts,
}: {
  parts: { label: string; value: number; tone: 1 | 2 | 3 | 4 | 'neutral' }[];
}) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  const bg = (t: (typeof parts)[number]['tone']) => (t === 'neutral' ? 'var(--onix-chart-neutral)' : `var(--onix-chart-${t})`);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-canvas-subtle">
        {parts.map((p) =>
          p.value > 0 ? (
            <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: bg(p.tone) }} title={`${p.label}: ${p.value}`} />
          ) : null,
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: bg(p.tone) }} />
            {p.label} <span className="tabular-nums text-ink">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Mapa de calor */

export function Heatmap({
  cols,
  rows,
}: {
  cols: string[];
  rows: { key: string; label: string; sub?: string; cells: (number | null | undefined)[]; flagged?: boolean }[];
}) {
  const fill = (v: number | null | undefined) =>
    v === undefined ? 'transparent' : v === null ? 'var(--onix-bg-subtle)' : `var(--onix-chart-${v})`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th className="w-full" />
            {cols.map((c) => (
              <th key={c} className="whitespace-nowrap px-1 pb-1 text-center text-[11px] font-medium text-ink-subtle">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="max-w-[280px] pr-3">
                <div className="flex items-center gap-2">
                  {r.flagged ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-label="Desacuerdo" /> : <span className="w-1.5 shrink-0" />}
                  <span className="truncate text-ink" title={r.label}>
                    {r.label}
                  </span>
                </div>
                {r.sub ? <div className="pl-3.5 text-[11px] text-ink-subtle">{r.sub}</div> : null}
              </td>
              {r.cells.map((v, i) => (
                <td
                  key={i}
                  className="h-7 min-w-[52px] rounded text-center tabular-nums"
                  style={{
                    background: fill(v),
                    color: v != null && v >= 3 ? 'var(--onix-accent-contrast)' : 'var(--onix-text-muted)',
                  }}
                >
                  {v === undefined ? '' : v === null ? '?' : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- Matriz de priorización */

export interface MatrixPoint {
  id: string;
  label: string;
  x: number; // factibilidad 0 a 100
  y: number; // valor 0 a 100
  risk: string;
  blocked?: boolean;
  n?: number; // número en el ranking
}

export function PriorityMatrix({ points }: { points: MatrixPoint[] }) {
  const W = 560;
  const H = 400;
  const m = { l: 34, r: 16, t: 16, b: 34 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const X = (v: number) => m.l + (v / 100) * iw;
  const Y = (v: number) => m.t + ih - (v / 100) * ih;
  const ring: Record<string, number> = { Bajo: 1, Medio: 2, Alto: 3, Inaceptable: 4 };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Matriz de valor contra factibilidad">
      <rect x={X(50)} y={Y(100)} width={iw / 2} height={ih / 2} fill="color-mix(in srgb, var(--onix-accent) 6%, transparent)" />
      <line x1={X(50)} y1={Y(0)} x2={X(50)} y2={Y(100)} stroke={C.grid} />
      <line x1={X(0)} y1={Y(50)} x2={X(100)} y2={Y(50)} stroke={C.grid} />
      <rect x={m.l} y={m.t} width={iw} height={ih} fill="none" stroke={C.grid} />
      {[
        { t: 'Proyectos estratégicos', x: 1, y: 99, a: 'start' },
        { t: 'Apuestas prioritarias', x: 99, y: 99, a: 'end' },
        { t: 'Revisar o pausar', x: 1, y: 3, a: 'start' },
        { t: 'Ganancias rápidas', x: 99, y: 3, a: 'end' },
      ].map((q) => (
        <text key={q.t} x={X(q.x)} y={Y(q.y) + (q.y > 50 ? 12 : -2)} fontSize={10.5} fill={C.subtle} textAnchor={q.a as 'start' | 'end'}>
          {q.t}
        </text>
      ))}
      <text x={X(50)} y={H - 8} fontSize={11} fill={C.muted} textAnchor="middle">
        Factibilidad →
      </text>
      <text x={12} y={Y(50)} fontSize={11} fill={C.muted} textAnchor="middle" transform={`rotate(-90 12 ${Y(50)})`}>
        Valor →
      </text>
      {(() => {
        // separa puntos que caen casi en el mismo lugar
        const placed: { x: number; y: number }[] = [];
        return points.map((p) => {
          let x = X(Math.max(4, Math.min(96, p.x)));
          let y = Y(Math.max(4, Math.min(96, p.y)));
          for (let k = 0; k < 12 && placed.some((q) => Math.hypot(q.x - x, q.y - y) < 20); k++) {
            const a = (k * Math.PI) / 3;
            x += Math.cos(a) * 14;
            y += Math.sin(a) * 14;
          }
          placed.push({ x, y });
          return (
            <g key={p.id}>
              <title>{`${p.n ? `${p.n}. ` : ''}${p.label} · riesgo ${p.risk}`}</title>
              <circle
                cx={x}
                cy={y}
                r={10}
                fill={p.blocked ? C.surface : `var(--onix-chart-${ring[p.risk] ?? 2})`}
                stroke={p.blocked ? C.neutral : C.accent}
                strokeWidth={1.25}
                strokeDasharray={p.blocked ? '2 2' : undefined}
              />
              <text
                x={x}
                y={y + 3.5}
                fontSize={10}
                fontWeight={600}
                textAnchor="middle"
                fill={p.blocked ? C.muted : (ring[p.risk] ?? 2) >= 3 ? '#fff' : C.text}
              >
                {p.blocked ? '×' : p.n ?? ''}
              </text>
            </g>
          );
        });
      })()}
    </svg>
  );
}

/* ---------------------------------------------------------------- Radar tecnológico */

export function TechRadar({
  sectors,
  rings,
  items,
}: {
  sectors: { k: string; n: string }[];
  rings: readonly string[];
  items: { tool: string; eco: string; ring: string; risky?: boolean }[];
}) {
  const W = 520;
  const cx = W / 2;
  const cy = W / 2;
  const R = 200;
  const n = sectors.length;
  const ringR = (i: number) => (R * (i + 1)) / rings.length;
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="h-auto w-full" role="img" aria-label="Radar tecnológico">
      {rings.map((rn, i) => (
        <g key={rn}>
          <circle cx={cx} cy={cy} r={ringR(i)} fill="none" stroke={C.grid} />
          <text x={cx + 4} y={cy - ringR(i) + 12} fontSize={9.5} fill={C.subtle}>
            {rn}
          </text>
        </g>
      ))}
      {sectors.map((s, i) => {
        const a = ang(i);
        const la = ang(i + 0.5);
        return (
          <g key={s.k}>
            <line x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke={C.grid} />
            <text
              x={cx + Math.cos(la) * (R + 22)}
              y={cy + Math.sin(la) * (R + 22) + 4}
              fontSize={10.5}
              fill={C.muted}
              textAnchor={Math.abs(Math.cos(la)) < 0.3 ? 'middle' : Math.cos(la) > 0 ? 'start' : 'end'}
            >
              {s.n}
            </text>
          </g>
        );
      })}
      {sectors.map((s, si) => {
        const mine = items.filter((it) => it.eco === s.k);
        return mine.map((it, j) => {
          const ri = Math.max(0, rings.indexOf(it.ring));
          const r = ringR(ri) - R / rings.length / 2;
          const a = ang(si + (j + 1) / (mine.length + 1));
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          return (
            <g key={`${s.k}-${it.tool}`}>
              <circle cx={x} cy={y} r={5} fill={it.risky ? C.surface : C.accent} stroke={C.accent} strokeWidth={1.5}>
                <title>{`${it.tool} · ${it.ring}`}</title>
              </circle>
              <text x={x} y={y - 8} fontSize={9.5} fill={C.text} textAnchor="middle">
                {it.tool.length > 18 ? `${it.tool.slice(0, 17)}…` : it.tool}
              </text>
            </g>
          );
        });
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------- Comparativo */

export function CompareBars({
  rows,
}: {
  rows: { label: string; before: number; after: number; projected?: number | null; target?: number | null }[];
}) {
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const delta = r.after - r.before;
        return (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink">{r.label}</span>
              <span className="tabular-nums text-ink-muted">
                {r.before} → <span className="text-ink">{r.after}</span>{' '}
                <span className={delta >= 0 ? 'text-success' : 'text-danger'}>
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </span>
              </span>
            </div>
            <div className="relative mt-1.5 h-1.5 rounded-full bg-canvas-subtle">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${r.after}%`, background: 'var(--onix-accent)' }} />
              <div className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink-subtle" style={{ left: `${r.before}%` }} title={`Anterior ${r.before}`} />
              {r.target != null ? <div className="absolute -top-1 h-3.5 w-px bg-ink" style={{ left: `${r.target}%` }} title={`Meta ${r.target}`} /> : null}
            </div>
            {r.projected != null ? (
              <p className="mt-1 text-[11px] text-ink-subtle">
                Proyectado {r.projected}
                {r.after < r.projected - 12 ? ' · por debajo de lo proyectado, revisar' : ''}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
