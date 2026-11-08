import { Suspense } from 'react';
import Link from 'next/link';
import { DIMS, levelName } from '@onix/engine';
import {
  inviteRespondentAction,
  launchAssessmentAction,
  publishAssessmentAction,
} from '@/lib/actions/assessments';
import { FEATURES } from '@/lib/features';
import { loadAssessmentBundle } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

export default async function EvaluacionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const tab = params.tab ?? 'seguimiento';
  const data = await loadAssessmentBundle(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';

  return (
    <div>
      <PageHeader
        title="Evaluación"
        description="Seguimiento, resultados oficiales, perfil tecnológico y comparativo (v1.5)."
      />
      <Suspense fallback={null}>
        <Tabs
          basePath="/evaluacion"
          items={[
            { id: 'seguimiento', label: 'Seguimiento' },
            { id: 'resultados', label: 'Resultados y brechas' },
            { id: 'perfil', label: 'Perfil tecnológico' },
            { id: 'comparativo', label: 'Comparativo', hidden: !FEATURES.v15 },
          ]}
        />
      </Suspense>

      <div className="mt-6">
        {tab === 'seguimiento' ? (
          <div className="space-y-4">
            <section className="onix-panel p-5">
              <h2 className="text-sm font-medium text-ink">Evaluación actual</h2>
              {data.assessment ? (
                <div className="mt-3 space-y-1 text-sm text-ink-muted">
                  <p>{data.assessment.title}</p>
                  <p>
                    Estado: <span className="text-ink">{data.assessment.status}</span> · Ruta{' '}
                    {data.assessment.saasRoute ?? '—'}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">No hay evaluación. Lanza una para empezar.</p>
              )}

              {canWrite ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={launchAssessmentAction} className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-ink-muted">
                      Ruta
                      <select name="route" className="onix-input mt-1 w-28" defaultValue="38">
                        <option value="15">15</option>
                        <option value="27">27</option>
                        <option value="38">38</option>
                      </select>
                    </label>
                    <button type="submit" className="onix-btn-primary">
                      Lanzar evaluación
                    </button>
                  </form>
                  {data.assessment && data.assessment.status !== 'completed' ? (
                    <form action={publishAssessmentAction}>
                      <input type="hidden" name="assessmentId" value={data.assessment.id} />
                      <button type="submit" className="onix-btn-ghost">
                        Publicar resultados
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </section>

            {data.assessment && canWrite ? (
              <section className="onix-panel p-5">
                <h2 className="text-sm font-medium text-ink">Invitar respondente</h2>
                <form action={inviteRespondentAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="assessmentId" value={data.assessment.id} />
                  <input
                    className="onix-input max-w-xs"
                    name="email"
                    type="email"
                    required
                    placeholder="correo@empresa.com"
                  />
                  <button type="submit" className="onix-btn-primary">
                    Generar enlace
                  </button>
                </form>
                <ul className="mt-4 space-y-2 text-xs text-ink-muted">
                  {data.invitations.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center gap-2">
                      <span>{inv.email}</span>
                      <span>· {inv.status}</span>
                      {inv.status === 'pending' ? (
                        <Link className="text-accent underline" href={`/r/${encodeURIComponent(inv.token)}`}>
                          Abrir portal
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {FEATURES.v15 ? (
              <section className="onix-panel p-5">
                <h2 className="text-sm font-medium text-ink">Reevaluación (v1.5)</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  La reevaluación periódica está detrás de FEATURE_V1_5. Actívala para comparar oleadas.
                </p>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === 'resultados' ? (
          <div className="space-y-4">
            <section className="onix-panel p-5">
              <h2 className="text-sm font-medium text-ink">Resultados oficiales</h2>
              {data.assessment?.status === 'completed' ? (
                <>
                  <p className="mt-3 font-display text-3xl text-ink">{data.assessment.globalScore}</p>
                  <p className="text-sm text-ink-muted">
                    Nivel {data.assessment.globalLevel} ·{' '}
                    {data.assessment.globalLevel ? levelName(data.assessment.globalLevel) : ''}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {DIMS.map((dim) => {
                      const row = data.dims.find((d) => d.dimension === dim.k);
                      return (
                        <div key={dim.k} className="rounded-md border border-border p-3">
                          <p className="text-xs text-ink-subtle">{dim.n}</p>
                          <p className="text-xl text-ink">{row?.score ?? '—'}</p>
                          <p className="text-xs text-ink-muted">Nivel {row?.level ?? '—'}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">Publica la evaluación para ver resultados.</p>
              )}
            </section>
            <section className="onix-panel p-5">
              <h2 className="text-sm font-medium text-ink">Brechas</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.gapRows.map((g) => (
                  <li key={g.id} className="text-ink-muted">
                    {g.fromDimension} (N{g.fromLevel}) → {g.toDimension} (N{g.toLevel}) · Δ{g.delta}
                  </li>
                ))}
                {data.gapRows.length === 0 ? (
                  <li className="text-ink-muted">Sin brechas registradas.</li>
                ) : null}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === 'perfil' ? (
          <section className="onix-panel p-5">
            <h2 className="text-sm font-medium text-ink">Perfil tecnológico</h2>
            {data.tech.map((t) => (
              <div key={t.id} className="mt-3">
                <p className="text-ink">{t.name}</p>
                <p className="mt-1 text-sm text-ink-muted">{(t.stack as string[]).join(' · ')}</p>
                {t.notes ? <p className="mt-2 text-xs text-ink-subtle">{t.notes}</p> : null}
              </div>
            ))}
            {data.tech.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">Sin perfil tecnológico.</p>
            ) : null}
          </section>
        ) : null}

        {tab === 'comparativo' && FEATURES.v15 ? (
          <section className="onix-panel p-5">
            <h2 className="text-sm font-medium text-ink">Comparativo</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Vista v1.5: compara oleadas de reevaluación cuando haya más de una publicación.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
