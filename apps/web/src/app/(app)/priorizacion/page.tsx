import { scorePrioritization } from '@onix/engine';
import { updateWeightsAction } from '@/lib/actions/prioritization';
import { loadPrioritization } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';

export default async function PriorizacionPage() {
  const session = await requireSession();
  const { weights, cases } = await loadPrioritization(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';

  const w = weights
    ? {
        impactoNegocio: Number(weights.impactoNegocio),
        urgenciaRegulatoria: Number(weights.urgenciaRegulatoria),
        facilidadImplementacion: Number(weights.facilidadImplementacion),
        dependenciaOtros: Number(weights.dependenciaOtros),
        riesgoResidual: Number(weights.riesgoResidual),
        valorAprendizaje: Number(weights.valorAprendizaje),
      }
    : {
        impactoNegocio: 0.25,
        urgenciaRegulatoria: 0.2,
        facilidadImplementacion: 0.15,
        dependenciaOtros: 0.1,
        riesgoResidual: 0.2,
        valorAprendizaje: 0.1,
      };

  const scored = cases.map((c, i) => {
    // Heurística demo: criterios derivados del índice / riesgo
    const riskBoost = c.risk === 'Alto' || c.risk === 'Inaceptable' ? 4 : c.risk === 'Medio' ? 3 : 2;
    const criteria = {
      impactoNegocio: 2 + (i % 3),
      urgenciaRegulatoria: riskBoost,
      facilidadImplementacion: 3,
      dependenciaOtros: 2,
      riesgoResidual: riskBoost,
      valorAprendizaje: 2 + (i % 2),
    };
    const result = scorePrioritization(criteria, w);
    return { case: c, score: result?.normalized ?? 0, ease: criteria.facilidadImplementacion };
  });

  return (
    <div>
      <PageHeader
        title="Priorización"
        description="Matriz valor–esfuerzo con pesos ajustables. Orientativo."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="onix-panel relative aspect-square max-h-[560px] p-4">
          <div className="pointer-events-none absolute inset-4 grid grid-cols-2 grid-rows-2 opacity-40">
            <div className="border border-dashed border-border p-2 text-xs text-ink-subtle">Quick wins</div>
            <div className="border border-dashed border-border p-2 text-right text-xs text-ink-subtle">
              Grandes apuestas
            </div>
            <div className="border border-dashed border-border p-2 text-xs text-ink-subtle">Backlog</div>
            <div className="border border-dashed border-border p-2 text-right text-xs text-ink-subtle">
              Revisar
            </div>
          </div>
          <div className="relative h-full w-full">
            {scored.map((s) => {
              const x = Math.min(95, Math.max(5, s.ease * 18));
              const y = Math.min(95, Math.max(5, 100 - s.score));
              return (
                <div
                  key={s.case.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-sm"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={s.case.name}
                >
                  <span className="max-w-[120px] truncate">{s.case.name}</span>
                  <div className="mt-0.5">
                    <RiskDot risk={s.case.risk} />
                  </div>
                </div>
              );
            })}
            {scored.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
                Agrega casos en Inventario para priorizarlos.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="onix-panel h-fit p-4">
          <h2 className="text-sm font-medium text-ink">Pesos</h2>
          {canWrite ? (
            <form action={updateWeightsAction} className="mt-3 space-y-2">
              {(
                [
                  ['impactoNegocio', 'Impacto de negocio'],
                  ['urgenciaRegulatoria', 'Urgencia regulatoria'],
                  ['facilidadImplementacion', 'Facilidad'],
                  ['dependenciaOtros', 'Dependencia'],
                  ['riesgoResidual', 'Riesgo residual'],
                  ['valorAprendizaje', 'Valor de aprendizaje'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-ink-muted">
                  {label}
                  <input
                    className="onix-input mt-1"
                    type="number"
                    step="0.01"
                    min="0"
                    name={key}
                    defaultValue={w[key]}
                  />
                </label>
              ))}
              <button type="submit" className="onix-btn-primary w-full">
                Guardar pesos
              </button>
            </form>
          ) : (
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {Object.entries(w).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
