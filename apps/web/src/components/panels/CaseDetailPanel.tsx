import { updateUseCaseAction } from '@/lib/actions/inventory';
import { RiskDot } from '@/components/ui/RiskDot';

type CaseRow = {
  id: string;
  name: string;
  description: string | null;
  risk: string;
  area: string | null;
  origin: string;
  status: string;
} | null;

export function CaseDetailPanel({ caseRow, canWrite }: { caseRow: CaseRow; canWrite: boolean }) {
  if (!caseRow) {
    return (
      <aside className="onix-panel h-fit p-4 text-sm text-ink-muted">
        Selecciona un caso para ver el detalle (panel lateral, no es una pantalla nueva).
      </aside>
    );
  }

  return (
    <aside className="onix-panel h-fit p-4">
      <h3 className="text-sm font-medium text-ink">Detalle del caso</h3>
      <p className="mt-2 text-ink">{caseRow.name}</p>
      <div className="mt-2">
        <RiskDot risk={caseRow.risk} />
      </div>
      {canWrite ? (
        <form action={updateUseCaseAction} className="mt-4 space-y-2">
          <input type="hidden" name="id" value={caseRow.id} />
          <input className="onix-input" name="name" defaultValue={caseRow.name} />
          <textarea
            className="onix-input"
            name="description"
            rows={3}
            defaultValue={caseRow.description ?? ''}
          />
          <input className="onix-input" name="area" defaultValue={caseRow.area ?? ''} />
          <select className="onix-input" name="risk" defaultValue={caseRow.risk}>
            <option>Bajo</option>
            <option>Medio</option>
            <option>Alto</option>
            <option>Inaceptable</option>
          </select>
          <select className="onix-input" name="origin" defaultValue={caseRow.origin}>
            <option value="manual">manual</option>
            <option value="discovery">discovery</option>
            <option value="import">import</option>
          </select>
          <select className="onix-input" name="status" defaultValue={caseRow.status}>
            <option>Propuesto</option>
            <option>En revisión</option>
            <option>Aprobado</option>
            <option>Descartado</option>
          </select>
          <button type="submit" className="onix-btn-primary w-full">
            Guardar
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">{caseRow.description}</p>
      )}
    </aside>
  );
}
