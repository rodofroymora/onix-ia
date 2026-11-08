import Link from 'next/link';
import { X } from 'lucide-react';
import { DIMS } from '@onix/engine';
import {
  addDependencyAction,
  removeDependencyAction,
  reviewEvidenceAction,
  submitEvidenceAction,
  updateActionProgressAction,
} from '@/lib/actions/plan';
import type { ActionRow } from '@/lib/server/insights';

type EvidenceRow = { id: string; status: string; label: string; url: string | null; notes: string | null; createdAt: Date };

const EV_STATUS: Record<string, string> = { pending: 'Por revisar', approved: 'Aprobada', rejected: 'Rechazada', none: 'Sin evidencia' };

/** Detalle de una acción del plan (CU-12) en panel lateral. */
export function ActionDrawer({
  a,
  stageName,
  evidence,
  canWrite,
  isConsultant,
  closeHref,
  allActions,
  deps,
  depError,
}: {
  a: ActionRow;
  stageName: string;
  evidence: EvidenceRow[];
  canWrite: boolean;
  isConsultant: boolean;
  closeHref: string;
  allActions: { id: string; title: string }[];
  deps: { id: string; fromActionId: string; toActionId: string; weight: number }[];
  depError: string | null;
}) {
  const titleOf = (id: string) => allActions.find((x) => x.id === id)?.title ?? 'Acción';
  const upstream = deps.filter((d) => d.toActionId === a.id);
  const downstream = deps.filter((d) => d.fromActionId === a.id);
  const dim = DIMS.find((d) => d.k === a.dimension)?.n ?? 'General';
  const hasApproved = evidence.some((e) => e.status === 'approved');
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/15">
      <Link href={closeHref} className="flex-1" aria-label="Cerrar" />
      <aside className="h-full w-full max-w-[480px] overflow-y-auto border-l border-border bg-surface shadow-md">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="onix-label">
              {stageName} · {dim}
              {a.critical ? ' · crítica' : ''}
            </p>
            <p className="mt-1 text-[16px] font-semibold leading-snug text-ink">{a.title}</p>
            {a.summary ? <p className="mt-1 text-[13px] text-ink-muted">{a.summary}</p> : null}
          </div>
          <Link href={closeHref} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-6 px-6 py-5">
          <form action={updateActionProgressAction} className="space-y-4">
            <input type="hidden" name="actionId" value={a.id} />
            <fieldset disabled={!canWrite}>
              <legend className="text-[12px] text-ink-muted">Avance</legend>
              <div className="mt-1.5 grid grid-cols-5 gap-1">
                {['0', '25', '50', '75', '100'].map((v) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="progress" value={v} defaultChecked={a.progress === v} className="peer sr-only" />
                    <span className="flex h-9 items-center justify-center rounded-md border border-border text-[12px] tabular-nums text-ink-muted transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas">
                      {v}%
                    </span>
                  </label>
                ))}
              </div>
              {!hasApproved ? <p className="mt-1.5 text-[11px] text-ink-subtle">El 100% se confirma al aprobar la evidencia; mientras, queda en 75%.</p> : null}
              <label className="mt-4 block text-[12px] text-ink-muted">
                Fecha compromiso
                <input type="date" name="dueDate" defaultValue={a.dueDate ?? ''} className="onix-input mt-1" />
              </label>
              <p className="mt-2 text-[11px] text-ink-subtle">Al cerrarla suma hasta {a.liftPoints} puntos a {dim.toLowerCase()} en la proyección.</p>
            </fieldset>
            {canWrite ? <button className="onix-btn-primary w-full">Guardar avance</button> : null}
          </form>

          <div className="border-t border-border pt-5">
            <p className="onix-label mb-3">Dependencias</p>
            {depError ? <p className="mb-2 text-[12px] text-danger">{depError}</p> : null}
            <ul className="space-y-1.5 text-[13px]">
              {upstream.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">
                    <span className="text-ink-subtle">Depende de </span>
                    {titleOf(d.fromActionId)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-ink-muted">{d.weight}%</span>
                    {canWrite ? (
                      <form action={removeDependencyAction}>
                        <input type="hidden" name="dependencyId" value={d.id} />
                        <button className="text-[12px] text-ink-subtle hover:text-danger" aria-label="Quitar">
                          Quitar
                        </button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
              {downstream.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">
                    <span className="text-ink-subtle">Impacta a </span>
                    {titleOf(d.toActionId)}
                  </span>
                  <span className="tabular-nums text-ink-muted">{d.weight}%</span>
                </li>
              ))}
              {!upstream.length && !downstream.length ? <li className="text-ink-subtle">Sin dependencias.</li> : null}
            </ul>
            {canWrite ? (
              <form action={addDependencyAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="toActionId" value={a.id} />
                <label className="min-w-0 flex-1 text-[12px] text-ink-muted">
                  Depende de
                  <select name="fromActionId" required className="onix-input mt-1 py-1.5 text-[12px]" defaultValue="">
                    <option value="" disabled>
                      Elegir acción
                    </option>
                    {allActions
                      .filter((x) => x.id !== a.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="w-20 text-[12px] text-ink-muted">
                  %
                  <input name="weight" type="number" min={1} max={100} defaultValue={50} className="onix-input mt-1 py-1.5 text-right tabular-nums" />
                </label>
                <button className="onix-btn-ghost py-1.5">Agregar</button>
              </form>
            ) : null}
            <p className="mt-2 text-[11px] text-ink-subtle">El porcentaje indica qué tanto necesita esta acción a la otra para avanzar.</p>
          </div>

          <div className="border-t border-border pt-5">
            <p className="onix-label mb-3">Evidencia</p>
            <ul className="space-y-3">
              {evidence.map((e) => (
                <li key={e.id} className="rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink">{e.label}</p>
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[12px] text-ink-muted underline">
                          {e.url}
                        </a>
                      ) : null}
                      {e.notes ? <p className="mt-1 text-[12px] text-ink-subtle">{e.notes}</p> : null}
                    </div>
                    <span className="onix-chip shrink-0">{EV_STATUS[e.status] ?? e.status}</span>
                  </div>
                  {isConsultant && e.status === 'pending' ? (
                    <form action={reviewEvidenceAction} className="mt-3 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="evidenceId" value={e.id} />
                      <input name="notes" placeholder="Comentario (opcional)" className="onix-input min-w-0 flex-1 py-1.5 text-[12px]" />
                      <button name="decision" value="approved" className="onix-btn-primary py-1.5">
                        Aprobar
                      </button>
                      <button name="decision" value="rejected" className="onix-btn-ghost py-1.5">
                        Rechazar
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {evidence.length === 0 ? <li className="text-[13px] text-ink-subtle">Aún sin evidencia.</li> : null}
            </ul>
            {canWrite ? (
              <form action={submitEvidenceAction} className="mt-4 space-y-2">
                <input type="hidden" name="actionId" value={a.id} />
                <input name="label" required placeholder="Qué comprueba (ej. política firmada)" className="onix-input" />
                <input name="url" type="url" placeholder="Enlace al documento (opcional)" className="onix-input" />
                <button className="onix-btn-ghost w-full">Subir evidencia</button>
              </form>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
