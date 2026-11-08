import { Suspense } from 'react';
import Link from 'next/link';
import { DIMS, levelName } from '@onix/engine';
import { FUNCTIONS, TECH_ECOSYSTEMS, TECH_RINGS, type TechItem } from '@onix/templates';
import { AssistantCard } from '@/components/assistant/AssistantCard';
import { CompareBars, Heatmap, MeterRow, RadarChart, SeriesKey, TechRadar } from '@/components/charts';
import { CopyButton, WhatsAppButton } from '@/components/ui/CopyButton';
import { Card, Empty, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { inviteRespondentAction, launchAssessmentAction, publishAssessmentAction } from '@/lib/actions/assessments';
import { saveTechProfileAction } from '@/lib/actions/tech';
import { respondentPath } from '@/lib/notify';
import { loadOrgOverview } from '@/lib/server/insights';
import { requireSession } from '@/lib/session';

const STATUS: Record<string, string> = {
  draft: 'Borrador',
  in_progress: 'En curso',
  completed: 'Publicada',
  archived: 'Archivada',
};

export default async function EvaluacionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dim?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const tab = params.tab ?? 'seguimiento';
  const o = await loadOrgOverview(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const focus = o.current ?? o.official;
  const inProgress = o.current && o.current.status !== 'completed' ? o.current : null;
  const dimName = (k: string) => DIMS.find((d) => d.k === k)?.n ?? k;

  return (
    <div>
      <PageHeader
        eyebrow="Ruta IA · paso 1"
        title="Evaluación"
        description="Quién contesta, qué dicen y dónde no coinciden. El nivel oficial solo cambia cuando publicas una evaluación."
        actions={
          canWrite ? (
            <>
              {!inProgress ? (
                <form action={launchAssessmentAction} className="flex items-center gap-2">
                  <select name="route" defaultValue="38" className="onix-input w-auto py-1.5 text-[13px]" aria-label="Ruta">
                    <option value="15">Rápida · 15</option>
                    <option value="27">Estándar · 27</option>
                    <option value="38">Completa · 38</option>
                  </select>
                  <button className="onix-btn-primary">{o.official ? 'Lanzar reevaluación' : 'Lanzar evaluación'}</button>
                </form>
              ) : (
                <form action={publishAssessmentAction}>
                  <input type="hidden" name="assessmentId" value={inProgress.id} />
                  <button className="onix-btn-primary">Publicar resultados</button>
                </form>
              )}
            </>
          ) : null
        }
      />
      <Suspense fallback={null}>
        <Tabs
          basePath="/evaluacion"
          items={[
            { id: 'seguimiento', label: 'Seguimiento' },
            { id: 'resultados', label: 'Resultados y brechas' },
            { id: 'perfil', label: 'Perfil tecnológico' },
            { id: 'comparativo', label: 'Comparativo' },
          ]}
        />
      </Suspense>

      <div className="mt-6 space-y-4">
        {/* ------------------------------------------------ Seguimiento */}
        {tab === 'seguimiento' ? (
          <>
            {focus ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label={focus.kind === 'reevaluacion' ? 'Reevaluación' : 'Revisión inicial'} value={STATUS[focus.status] ?? focus.status} sub={`${focus.title} · ruta de ${focus.saasRoute ?? 38} preguntas`} />
                <Kpi
                  label="Respondentes"
                  value={`${o.respondents.filter((r) => r.status === 'accepted').length} de ${o.respondents.length}`}
                  sub="terminaron su cuestionario"
                />
                <Kpi label="Funciones sin responsable" value={o.uncovered.length} sub={o.uncovered.join(', ') || 'Todas cubiertas'} />
              </div>
            ) : (
              <Empty title="Aún no hay evaluación">Lanza la Revisión inicial para invitar a los responsables de cada área.</Empty>
            )}

            {focus ? (
              <Card title="Respondentes">
                <table className="onix-table">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Funciones</th>
                      <th>Estado</th>
                      <th className="text-right">Respuestas</th>
                      <th className="text-right">Enlace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.respondents.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <p>{r.name}</p>
                          <p className="text-[11px] text-ink-subtle">{r.email}</p>
                        </td>
                        <td className="text-ink-muted">{r.functions.join(', ') || 'Todas'}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                            <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'accepted' ? 'bg-ink' : 'bg-border-strong'}`} />
                            {r.status === 'accepted' ? 'Contestó' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{r.answered}</td>
                        <td className="text-right">
                          {r.status === 'pending' && canWrite ? (
                            <span className="inline-flex gap-3">
                              <CopyButton text={respondentPath(r.token)} label="Copiar" />
                              <WhatsAppButton path={respondentPath(r.token)} name={r.name} org={session.user.organizationName} />
                            </span>
                          ) : (
                            <span className="text-[12px] text-ink-subtle">·</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {o.respondents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-ink-subtle">
                          Sin respondentes todavía.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </Card>
            ) : null}

            {inProgress && canWrite ? (
              <Card title="Invitar a un responsable">
                <form action={inviteRespondentAction} className="space-y-4">
                  <input type="hidden" name="assessmentId" value={inProgress.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[12px] text-ink-muted">
                      Nombre
                      <input name="name" className="onix-input mt-1" placeholder="Nombre y apellido" />
                    </label>
                    <label className="text-[12px] text-ink-muted">
                      Correo
                      <input name="email" type="email" required className="onix-input mt-1" placeholder="correo@empresa.com" />
                    </label>
                  </div>
                  <fieldset>
                    <legend className="text-[12px] text-ink-muted">Funciones que cubre (solo verá las preguntas de esas áreas)</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {FUNCTIONS.map((f) => (
                        <label key={f.k} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px] text-ink-muted has-[:checked]:border-ink has-[:checked]:text-ink">
                          <input type="checkbox" name="functions" value={f.k} className="sr-only" />
                          {f.n}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="onix-btn-primary">Generar invitación</button>
                    <p className="text-[12px] text-ink-subtle">Se envía por correo si está configurado; también puedes copiar el enlace o mandarlo por WhatsApp.</p>
                  </div>
                </form>
              </Card>
            ) : null}
          </>
        ) : null}

        {/* ------------------------------------------------ Resultados */}
        {tab === 'resultados' ? (
          o.official ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Madurez global" value={o.official.globalScore} sub={levelName(o.official.globalLevel ?? 1)} />
                {o.capas.map((c) => (
                  <Kpi key={c.capa} label={`Capa ${c.capa}`} value={c.score} sub={levelName(c.level)} />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-5">
                <Card title="Radar de madurez" className="lg:col-span-3">
                  <div className="mx-auto max-w-[440px]">
                    <RadarChart
                      axes={o.officialDims.map((d) => ({ label: d.lines }))}
                      series={[
                        ...(o.previousDims ? [{ name: 'Anterior', values: o.previousDims.map((d) => d.score), style: 'outline' as const }] : []),
                        { name: 'Actual', values: o.officialDims.map((d) => d.score), style: 'solid' as const },
                      ]}
                    />
                  </div>
                  <div className="mt-2 flex justify-center">
                    <SeriesKey items={[{ label: 'Actual', style: 'solid' }, ...(o.previousDims ? [{ label: 'Anterior', style: 'outline' as const }] : [])]} />
                  </div>
                </Card>
                <Card title="Por dimensión" className="lg:col-span-2">
                  <div className="space-y-4">
                    {o.officialDims.map((d) => (
                      <MeterRow key={d.dimension} label={d.name} value={d.score} hint={levelName(d.level)} />
                    ))}
                  </div>
                </Card>
              </div>

              <Card
                title="Mapa de respuestas por persona"
                aside={
                  <div className="flex flex-wrap gap-1">
                    <Link href="/evaluacion?tab=resultados" className={`rounded-full px-2 py-0.5 text-[11px] ${!params.dim ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink'}`}>
                      Desacuerdos
                    </Link>
                    {DIMS.map((d) => (
                      <Link
                        key={d.k}
                        href={`/evaluacion?tab=resultados&dim=${d.k}`}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${params.dim === d.k ? 'bg-ink text-canvas' : 'text-ink-muted hover:text-ink'}`}
                      >
                        {d.n.split(' ')[0]}
                      </Link>
                    ))}
                  </div>
                }
              >
                {(() => {
                  const people = o.respondents;
                  const codes = params.dim
                    ? [...o.questionByCode.values()]
                        .filter((q) => q.dimension === params.dim && q.kind === 'maturity')
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((q) => q.code)
                    : o.disagreements.map((g) => g.questionCode);
                  const flagged = new Set(o.disagreements.map((g) => g.questionCode));
                  const rows = codes.map((code) => {
                    const q = o.questionByCode.get(code);
                    return {
                      key: code,
                      label: q?.prompt ?? code,
                      sub: q?.dimension ? dimName(q.dimension) : undefined,
                      flagged: flagged.has(code),
                      cells: people.map((p) => {
                        const a = o.answers.find((x) => x.respondentId === p.id && x.questionCode === code);
                        return a ? a.value : undefined;
                      }),
                    };
                  });
                  return rows.length ? (
                    <>
                      <Heatmap cols={people.map((p) => p.name.split(' ')[0]!)} rows={rows} />
                      <p className="mt-3 text-[11px] text-ink-subtle">
                        Nivel de 1 (Inicial) a 4 (Gestionado). &quot;?&quot; es &quot;No sé&quot;; vacío, no le tocaba. El punto marca preguntas con diferencias de 2 niveles o más.
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-muted">Los respondentes coinciden: no hay diferencias de 2 niveles o más.</p>
                  );
                })()}
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Brechas para la entrevista">
                  <ol className="space-y-3">
                    {o.disagreements.slice(0, 5).map((g, i) => {
                      const q = o.questionByCode.get(g.questionCode);
                      return (
                        <li key={g.questionCode} className="flex gap-3">
                          <span className="mt-0.5 text-[12px] tabular-nums text-ink-subtle">{i + 1}</span>
                          <div>
                            <p className="text-[13px] text-ink">{q?.prompt ?? g.questionCode}</p>
                            <p className="mt-0.5 text-[12px] text-ink-muted">
                              {o.respondents
                                .filter((r) => r.id in g.values)
                                .map((r) => `${r.name.split(' ')[0]}: ${g.values[r.id] ?? 'No sé'}`)
                                .join(' · ')}{' '}
                              <span className="text-ink-subtle">· {dimName(g.dimension)}</span>
                            </p>
                          </div>
                        </li>
                      );
                    })}
                    {o.disagreements.length === 0 ? <li className="text-[13px] text-ink-muted">Sin desacuerdos relevantes.</li> : null}
                  </ol>
                </Card>
                <Card title="Puntos ciegos">
                  <p className="onix-label mb-2">Funciones sin responsable</p>
                  <p className="text-[13px] text-ink">{o.uncovered.length ? o.uncovered.join(', ') : 'Todas tienen responsable.'}</p>
                  <p className="onix-label mb-2 mt-5">Respuestas &quot;No sé&quot; por dimensión</p>
                  <div className="space-y-2">
                    {DIMS.filter((d) => o.unknownByDim[d.k] > 0).map((d) => (
                      <div key={d.k} className="flex justify-between text-[13px]">
                        <span className="text-ink">{d.n}</span>
                        <span className="tabular-nums text-ink-muted">{o.unknownByDim[d.k]}</span>
                      </div>
                    ))}
                    {DIMS.every((d) => o.unknownByDim[d.k] === 0) ? <p className="text-[13px] text-ink-muted">Ninguna.</p> : null}
                  </div>
                </Card>
              </div>
              <AssistantCard defaultTask="hallazgos" />
            </>
          ) : (
            <Empty title="Sin resultados publicados">Cuando contesten los respondentes, publica la evaluación para calcular el nivel oficial.</Empty>
          )
        ) : null}

        {/* ------------------------------------------------ Perfil tecnológico */}
        {tab === 'perfil' ? (
          (() => {
            const stack = (Array.isArray(o.tech?.stack) ? o.tech!.stack : []) as TechItem[];
            const structured = stack.filter((s) => typeof s === 'object' && s && 'tool' in s);
            return (
              <>
                <div className="grid gap-4 lg:grid-cols-5">
                  <Card title="Radar tecnológico" className="lg:col-span-3">
                    {structured.length ? (
                      <TechRadar
                        sectors={TECH_ECOSYSTEMS.filter((e) => structured.some((s) => s.eco === e.k)).map((e) => ({ k: e.k, n: e.n }))}
                        rings={TECH_RINGS}
                        items={structured.map((s) => ({ ...s, risky: s.license !== 'empresarial' }))}
                      />
                    ) : (
                      <p className="text-[13px] text-ink-muted">Marca las herramientas que usan para ver el radar.</p>
                    )}
                  </Card>
                  <Card title="Lectura" className="lg:col-span-2">
                    <div className="space-y-3 text-[13px]">
                      {TECH_RINGS.map((ring) => {
                        const list = structured.filter((s) => s.ring === ring);
                        return (
                          <div key={ring}>
                            <p className="onix-label">{ring}</p>
                            <p className="mt-1 text-ink">{list.map((s) => s.tool).join(', ') || 'Ninguna'}</p>
                          </div>
                        );
                      })}
                      <p className="border-t border-border pt-3 text-[12px] text-ink-subtle">
                        Lo que se usa con cuentas personales o gratuitas cae en &quot;Retirar&quot;: es IA en la sombra.
                      </p>
                    </div>
                  </Card>
                </div>
                {canWrite ? (
                  <Card title="Herramientas por ecosistema">
                    <form action={saveTechProfileAction}>
                      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                        {TECH_ECOSYSTEMS.map((eco) => (
                          <div key={eco.k}>
                            <p className="onix-label mb-2">{eco.n}</p>
                            <div className="space-y-1.5">
                              {eco.tools.map((tool) => {
                                const cur = structured.find((s) => s.tool === tool && s.eco === eco.k);
                                return (
                                  <div key={tool} className="flex items-center justify-between gap-2 text-[13px]">
                                    <span className="truncate text-ink">{tool}</span>
                                    <span className="flex shrink-0 gap-1.5">
                                      <select name={`ring:${eco.k}:${tool}`} defaultValue={cur?.ring ?? ''} className="onix-input w-28 py-1 text-[12px]" aria-label={`Estado de ${tool}`}>
                                        <option value="">No se usa</option>
                                        {TECH_RINGS.map((r) => (
                                          <option key={r} value={r}>
                                            {r}
                                          </option>
                                        ))}
                                      </select>
                                      <select name={`lic:${eco.k}:${tool}`} defaultValue={cur?.license ?? 'empresarial'} className="onix-input w-28 py-1 text-[12px]" aria-label={`Licencia de ${tool}`}>
                                        <option value="empresarial">Empresarial</option>
                                        <option value="personal">Personal</option>
                                        <option value="gratuita">Gratuita</option>
                                      </select>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="onix-btn-primary mt-6">Guardar perfil</button>
                    </form>
                  </Card>
                ) : null}
              </>
            );
          })()
        ) : null}

        {/* ------------------------------------------------ Comparativo */}
        {tab === 'comparativo' ? (
          o.previous && o.previousDims ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Anterior" value={o.previous.globalScore} sub={o.previous.title} />
                <Kpi label="Actual" value={o.official!.globalScore} sub={o.official!.title} />
                <Kpi
                  label="Cambio"
                  value={`${(o.official!.globalScore ?? 0) - (o.previous.globalScore ?? 0) >= 0 ? '+' : ''}${(o.official!.globalScore ?? 0) - (o.previous.globalScore ?? 0)}`}
                  sub="puntos de madurez global"
                />
              </div>
              <Card title="Por dimensión" aside={<span className="onix-chip">anterior → actual · meta</span>}>
                <CompareBars
                  rows={o.officialDims.map((d) => ({
                    label: d.name,
                    before: o.previousDims!.find((p) => p.dimension === d.dimension)?.score ?? 0,
                    after: d.score,
                    target: o.targets[d.dimension] ?? null,
                  }))}
                />
              </Card>
              <p className="text-[11px] text-ink-subtle">
                La reevaluación usa la misma versión del cuestionario para que la comparación sea justa. Las brechas nuevas alimentan el plan del siguiente ciclo.
              </p>
            </>
          ) : (
            <Empty title="Aún no hay con qué comparar">
              Después de la Revisión inicial, lanza una reevaluación en seis o doce meses para ver el avance con datos.
            </Empty>
          )
        ) : null}
      </div>
    </div>
  );
}
