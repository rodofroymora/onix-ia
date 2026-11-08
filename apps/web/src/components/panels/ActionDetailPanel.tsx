import { updateActionProgressAction } from '@/lib/actions/plan';

type ActionRow = {
  id: string;
  title: string;
  progress: string;
  critical: boolean;
  dimension: string | null;
} | null;

type EvidenceRow = {
  status: string;
  label: string;
} | null;

export function ActionDetailPanel({
  action,
  evidence,
  canWrite,
}: {
  action: ActionRow;
  evidence: EvidenceRow;
  canWrite: boolean;
}) {
  if (!action) {
    return (
      <aside className="onix-panel h-fit p-4 text-sm text-ink-muted">
        Selecciona una acción para ver el detalle.
      </aside>
    );
  }

  return (
    <aside className="onix-panel h-fit p-4">
      <h3 className="text-sm font-medium text-ink">Detalle de acción</h3>
      <p className="mt-2 text-ink">{action.title}</p>
      <p className="mt-1 text-xs text-ink-muted">
        Progreso {action.progress}%
        {action.critical ? ' · Crítica' : ''}
        {action.dimension ? ` · ${action.dimension}` : ''}
      </p>
      {evidence ? (
        <p className="mt-2 text-xs text-ink-subtle">
          Evidencia: {evidence.label} ({evidence.status})
        </p>
      ) : null}
      {canWrite ? (
        <form action={updateActionProgressAction} className="mt-4 space-y-2">
          <input type="hidden" name="actionId" value={action.id} />
          <select className="onix-input" name="progress" defaultValue={action.progress}>
            <option value="0">0</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="75">75</option>
            <option value="100">100</option>
          </select>
          <select className="onix-input" name="evidenceStatus" defaultValue={evidence?.status ?? 'none'}>
            <option value="none">Sin evidencia</option>
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobada</option>
            <option value="rejected">Rechazada</option>
          </select>
          <p className="text-[11px] text-ink-subtle">No puedes cerrar al 100 sin evidencia aprobada.</p>
          <button type="submit" className="onix-btn-primary w-full">
            Guardar progreso
          </button>
        </form>
      ) : null}
    </aside>
  );
}
