import Link from 'next/link';
import { PriorityMatrix } from '@/components/charts';
import { WeightsForm } from '@/components/panels/WeightsForm';
import { Card, PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { CRITERIA, caseCriteria, loadOrgOverview, type Quadrant } from '@/lib/server/insights';
import { requireSession } from '@/lib/session';

const SHORT: Record<string, string> = { riesgoResidual: 'Control', valorAprendizaje: 'Esfuerzo' };

const QUADRANT_HINT: Record<Quadrant, string> = {
  'Apuestas prioritarias': 'Mucho valor y factible: hacer ya.',
  'Proyectos estratégicos': 'Mucho valor pero cuesta: preparar datos y equipo.',
  'Ganancias rápidas': 'Fácil con valor moderado: aprovechar.',
  'Revisar o pausar': 'Poco valor y difícil: no invertir por ahora.',
};

export default async function PriorizacionPage() {
  const session = await requireSession();
  const o = await loadOrgOverview(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const ready = o.prioritized.filter((p) => p.score != null && !p.blocked);
  const pending = o.prioritized.filter((p) => p.score == null && !p.blocked);
  const blocked = o.prioritized.filter((p) => p.blocked);
  const quadrants = (Object.keys(QUADRANT_HINT) as Quadrant[]).map((q) => ({ q, items: ready.filter((p) => p.quadrant === q) }));

  return (
    <div>
      <PageHeader
        eyebrow="Ruta IA · paso 3"
        title="Priorización"
        description="Qué casos de IA conviene hacer primero, con un cálculo que cualquiera puede revisar y repetir."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card title="Valor contra factibilidad" aside={<span className="onix-chip">color = riesgo</span>}>
          <PriorityMatrix
            points={[...ready, ...blocked.filter((b) => b.missing.length === 0)].map((p, i) => ({
              id: p.c.id,
              n: p.blocked ? undefined : i + 1,
              label: p.c.name,
              x: p.feasibilityAxis,
              y: p.valueAxis,
              risk: p.c.risk,
              blocked: p.blocked,
            }))}
          />
          <ol className="mt-3 grid gap-x-6 gap-y-1 text-[12px] text-ink-muted sm:grid-cols-2">
            {ready.map((p, i) => (
              <li key={p.c.id} className="flex gap-2 truncate">
                <span className="w-4 shrink-0 text-right tabular-nums text-ink-subtle">{i + 1}</span>
                <Link href={`/inventario?caso=${p.c.id}`} className="truncate hover:text-ink">
                  {p.c.name}
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quadrants.map(({ q, items }) => (
              <div key={q} className="rounded-lg bg-canvas-subtle px-3 py-2.5">
                <p className="text-[12px] font-medium text-ink">
                  {q} <span className="tabular-nums text-ink-subtle">· {items.length}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">{QUADRANT_HINT[q]}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Pesos de los criterios">
          <WeightsForm criteria={CRITERIA} initial={o.weights} disabled={!canWrite} />
        </Card>
      </div>

      <Card title="Ranking" className="mt-4">
        <div className="overflow-x-auto">
          <table className="onix-table">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Caso</th>
                <th>Cuadrante</th>
                <th>Riesgo</th>
                {CRITERIA.map((c) => (
                  <th key={c.k} className="text-right" title={c.hint}>
                    {SHORT[c.k] ?? c.n.split(' ')[0]}
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
                    </td>
                    <td className="text-ink-muted">{p.quadrant}</td>
                    <td>
                      <RiskDot risk={p.c.risk} />
                    </td>
                    {CRITERIA.map((c) => (
                      <td key={c.k} className="text-right tabular-nums text-ink-muted">
                        {crit[c.k].toFixed(1)}
                      </td>
                    ))}
                    <td className="text-right font-medium tabular-nums">{p.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-subtle">
          Cada criterio va de 0 a 5 y se pondera con los pesos; el puntaje va de 0 a 100. Un caso inaceptable nunca se recomienda; uno de riesgo alto primero necesita sus controles.
        </p>
      </Card>

      {pending.length || blocked.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {pending.length ? (
            <Card title="Sin priorizar">
              <ul className="space-y-2 text-[13px]">
                {pending.map((p) => (
                  <li key={p.c.id} className="flex justify-between gap-3">
                    <Link href={`/inventario?caso=${p.c.id}`} className="text-ink hover:underline">
                      {p.c.name}
                    </Link>
                    <span className="shrink-0 text-[12px] text-ink-subtle">falta {p.missing.join(', ')}</span>
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
                    <span className="shrink-0 text-[12px] text-ink-subtle">
                      {p.c.risk === 'Inaceptable' ? 'Riesgo inaceptable' : 'Descartado'}
                    </span>
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
