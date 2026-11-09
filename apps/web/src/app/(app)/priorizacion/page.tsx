import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { PriorityOrbit } from '@/components/charts/PriorityOrbit';
import { WeightsForm } from '@/components/panels/WeightsForm';
import { Card, PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { CRITERIA, caseCriteria, loadOrgOverview, type Quadrant } from '@/lib/server/insights';
import { requireSession } from '@/lib/session';

const QUADRANT_HINT: Record<Quadrant, string> = {
  'Apuestas prioritarias': 'Mucho valor y factible: hacer ya.',
  'Proyectos estratégicos': 'Mucho valor pero cuesta: preparar datos y equipo.',
  'Ganancias rápidas': 'Fácil con valor moderado: aprovechar.',
  'Revisar o pausar': 'Poco valor y difícil: no invertir por ahora.',
};
const SHORT: Record<string, string> = {
  impactoNegocio: 'Valor',
  urgenciaRegulatoria: 'Alineación',
  facilidadImplementacion: 'Factibilidad',
  dependenciaOtros: 'Datos',
  riesgoResidual: 'Control',
  valorAprendizaje: 'Esfuerzo',
};

/** Celda de calor: más morado mientras más alto el criterio (0 a 5). */
function Heat({ v }: { v: number }) {
  const pct = Math.round((v / 5) * 100);
  return (
    <span
      className="inline-flex h-7 w-11 items-center justify-center rounded-md text-[12px] tabular-nums"
      style={{
        background: `color-mix(in srgb, var(--onix-accent) ${Math.max(6, pct * 0.62)}%, transparent)`,
        color: pct >= 70 ? 'var(--onix-accent-contrast)' : 'var(--onix-text)',
      }}
      title={`${v.toFixed(1)} de 5`}
    >
      {v.toFixed(1)}
    </span>
  );
}

export default async function PriorizacionPage() {
  const session = await requireSession();
  const o = await loadOrgOverview(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const ready = o.prioritized.filter((p) => p.score != null && !p.blocked);
  const pending = o.prioritized.filter((p) => p.score == null && !p.blocked);
  const blocked = o.prioritized.filter((p) => p.blocked);
  const quadrants = (Object.keys(QUADRANT_HINT) as Quadrant[]).map((q) => ({ q, items: ready.filter((p) => p.quadrant === q) }));
  const totalValue = ready.reduce((t, p) => t + (p.c.annualValue ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Ruta IA · paso 3"
        title="Priorización"
        description="Qué casos de IA conviene hacer primero, con un cálculo que cualquiera puede revisar y repetir."
        actions={
          <details className="group relative">
            <summary className="onix-btn-ghost cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.6} /> Pesos de los criterios
            </summary>
            <div className="onix-glass absolute right-0 z-30 mt-2 w-[340px] rounded-2xl p-4 shadow-md">
              <WeightsForm criteria={CRITERIA} initial={o.weights} disabled={!canWrite} />
            </div>
          </details>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card title="Órbita de prioridad" aside={<span className="onix-chip">más cerca del centro = más prioridad</span>}>
          <PriorityOrbit
            cases={ready.map((p, i) => ({
              id: p.c.id,
              name: p.c.name,
              score: p.score!,
              quadrant: p.quadrant!,
              risk: p.c.risk,
              annualValue: p.c.annualValue ?? null,
              valueAxis: p.valueAxis,
              feasibilityAxis: p.feasibilityAxis,
              rank: i + 1,
              criteria: CRITERIA.map((k) => ({ n: k.n, v: caseCriteria(p.c)[k.k] })),
            }))}
          />
          <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[12px] text-ink-muted">
            <span className="text-ink-subtle">Color = riesgo:</span>
            {[
              ['Bajo', 'var(--onix-chart-neutral)'],
              ['Medio', 'var(--onix-accent)'],
              ['Alto', 'var(--onix-warning)'],
            ].map(([k, c]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                {k}
              </span>
            ))}
            <span className="text-ink-subtle">Tamaño = valor anual · brillo = top 3 · toca un caso para abrirlo</span>
          </div>
        </Card>

        <div className="space-y-3">
          {quadrants.map(({ q, items }) => (
            <div key={q} className={`rounded-2xl px-4 py-3.5 ${q === 'Apuestas prioritarias' ? 'onix-glass' : 'onix-panel'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-[13px] font-semibold ${q === 'Apuestas prioritarias' ? 'text-accent' : 'text-ink'}`}>{q}</p>
                <span className="text-[20px] font-semibold tabular-nums text-ink">{items.length}</span>
              </div>
              <p className="text-[11.5px] text-ink-muted">{QUADRANT_HINT[q]}</p>
              {items.length ? (
                <p className="mt-1.5 truncate text-[12px] text-ink">{items.map((p) => p.c.name).join(' · ')}</p>
              ) : null}
            </div>
          ))}
          {totalValue ? (
            <p className="px-1 text-[12px] text-ink-subtle">Valor anual estimado del portafolio: ${totalValue.toLocaleString('es-MX')} MXN</p>
          ) : null}
        </div>
      </div>

      <Card title="Ranking y mapa de calor de criterios" className="mt-4">
        <div className="overflow-x-auto">
          <table className="onix-table onix-table-scroll">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th className="min-w-[180px]">Caso</th>
                <th>Riesgo</th>
                {CRITERIA.map((c) => (
                  <th key={c.k} className="text-center" title={c.hint}>
                    {SHORT[c.k]}
                    <span className="block text-[10px] font-normal normal-case tracking-normal text-ink-subtle">{Math.round((o.weights[c.k] ?? 0) * 100)}%</span>
                  </th>
                ))}
                <th className="text-right">Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((p, i) => {
                const crit = caseCriteria(p.c);
                return (
                  <tr key={p.c.id}>
                    <td className="tabular-nums text-ink-subtle">{i + 1}</td>
                    <td>
                      <Link href={`/inventario?caso=${p.c.id}`} className="hover:underline">
                        {p.c.name}
                      </Link>
                      <span className="block text-[11px] text-ink-subtle">{p.quadrant}</span>
                    </td>
                    <td>
                      <RiskDot risk={p.c.risk} />
                    </td>
                    {CRITERIA.map((c) => (
                      <td key={c.k} className="text-center">
                        <Heat v={crit[c.k]} />
                      </td>
                    ))}
                    <td className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-canvas-subtle">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${p.score}%` }} />
                        </span>
                        <span className="w-7 text-right font-semibold tabular-nums">{p.score}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-subtle">
          Cada criterio va de 0 a 5 (más morado, mejor) y se pondera con los pesos de arriba; el puntaje va de 0 a 100. Un caso inaceptable nunca se recomienda.
        </p>
      </Card>

      {pending.length || blocked.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {pending.length ? (
            <Card title="Sin priorizar">
              <ul className="space-y-2 text-[13px]">
                {pending.map((p) => (
                  <li key={p.c.id} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                    <Link href={`/inventario?caso=${p.c.id}`} className="text-ink hover:underline">
                      {p.c.name}
                    </Link>
                    <span className="text-[12px] text-ink-subtle sm:shrink-0">falta {p.missing.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {blocked.length ? (
            <Card title="Fuera del portafolio">
              <ul className="space-y-2 text-[13px]">
                {blocked.map((p) => (
                  <li key={p.c.id} className="flex justify-between gap-3">
                    <span className="text-ink">{p.c.name}</span>
                    <span className="shrink-0 text-[12px] text-ink-subtle">{p.c.risk === 'Inaceptable' ? 'Riesgo inaceptable' : 'Descartado'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
