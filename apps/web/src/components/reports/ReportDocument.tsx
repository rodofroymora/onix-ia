import { DIMS, levelName } from '@onix/engine';
import { MeterRow, RadarChart, SeriesKey, StackBar } from '@/components/charts';
import { RiskDot } from '@/components/ui/RiskDot';
import { actionProgress, type OrgOverview } from '@/lib/server/insights';
import type { ReportKind } from '@/lib/report-kinds';

const dimName = (k: string | null) => DIMS.find((d) => d.k === k)?.n ?? 'General';
const fmt = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-border pt-6">
      <h2 className="flex items-baseline gap-3 text-[15px] font-semibold text-ink">
        <span className="onix-report-num tabular-nums text-ink-subtle" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Figure({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tabular-nums leading-none text-ink">{value}</p>
      {sub ? <p className="mt-1 text-[12px] text-ink-muted">{sub}</p> : null}
    </div>
  );
}

/**
 * Cuerpo del informe (CU-11). El resumen es texto editable; el resto sale de los datos vigentes
 * para que el informe y la plataforma nunca se contradigan.
 */
export function ReportDocument({
  kind,
  o,
  orgName,
  title,
  date,
  summary,
  note,
}: {
  kind: ReportKind;
  o: OrgOverview;
  orgName: string;
  title: string;
  date: string;
  summary: React.ReactNode;
  note: string;
}) {
  const g = o.official?.globalScore ?? 0;
  const prevG = o.previous?.globalScore ?? null;
  const delta = prevG != null ? g - prevG : null;
  const high = o.cases.filter((c) => c.risk === 'Alto' || c.risk === 'Inaceptable');
  const top = o.prioritized.filter((p) => !p.blocked && p.score != null).slice(0, 5);
  const closed = o.actions.filter((a) => actionProgress(a) === 100);
  const critical = o.actions.filter((a) => a.critical && actionProgress(a) < 100);
  const stageRows = o.stages.map((s) => {
    const acts = o.actions.filter((a) => a.stageId === s.id);
    const pct = acts.length ? Math.round(acts.reduce((t, a) => t + actionProgress(a), 0) / acts.length) : 0;
    return { name: s.name, pct, count: acts.length, done: acts.filter((a) => actionProgress(a) === 100).length };
  });
  const risks = ['Bajo', 'Medio', 'Alto', 'Inaceptable'] as const;

  const header = (
    <header className="flex items-start justify-between gap-6 pb-6">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-subtle">Ónix Govern · {orgName}</p>
        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {date}
          {o.official ? ` · con datos de ${o.official.title}` : ''}
        </p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-canvas">Ó</span>
    </header>
  );

  const keyFigures = (
    <div className="grid grid-cols-2 gap-6 rounded-xl bg-canvas-subtle px-6 py-5 sm:grid-cols-4">
      <Figure
        label="Madurez global"
        value={o.official ? g : '·'}
        sub={o.official ? `${levelName(o.official.globalLevel ?? 1)}${delta != null ? ` · ${delta >= 0 ? '+' : ''}${delta} vs. anterior` : ''}` : 'Sin evaluación publicada'}
      />
      <Figure label="Casos de IA" value={o.cases.length} sub={`${high.length} de riesgo alto o inaceptable`} />
      <Figure label="Avance del plan" value={`${o.planPct}%`} sub={`${closed.length} de ${o.actions.length} con evidencia`} />
      <Figure label="Vencidas" value={o.overdue.length} sub={`${critical.length} críticas abiertas`} />
    </div>
  );

  const summaryBlock = (
    <Section title={kind === 'avance' ? 'Lo que sigue' : 'Resumen'}>
      {summary}
    </Section>
  );

  const maturity = o.official ? (
    <Section title="Madurez por dimensión">
      <div className="grid items-center gap-6 md:grid-cols-[0.9fr_1.3fr]">
        <div>
          <RadarChart
            axes={o.officialDims.map((d) => ({ label: d.lines }))}
            series={[
              ...(o.previousDims ? [{ name: 'Anterior', values: o.previousDims.map((d) => d.score), style: 'outline' as const }] : []),
              { name: 'Meta', values: DIMS.map((d) => o.targets[d.k] ?? 0), style: 'dashed' as const },
              { name: 'Actual', values: o.officialDims.map((d) => d.score), style: 'solid' as const },
            ]}
            size={260}
          />
          <div className="mt-1 flex justify-center">
            <SeriesKey
              items={[
                { label: 'Actual', style: 'solid' },
                ...(o.previousDims ? [{ label: 'Anterior', style: 'outline' as const }] : []),
                { label: 'Meta', style: 'dashed' },
              ]}
            />
          </div>
        </div>
        <table className="onix-table">
          <thead>
            <tr>
              <th>Dimensión</th>
              <th className="text-right">Actual</th>
              {o.previousDims ? <th className="text-right">Anterior</th> : null}
              <th className="text-right">Meta</th>
              <th>Nivel</th>
            </tr>
          </thead>
          <tbody>
            {o.officialDims.map((d, i) => (
              <tr key={d.dimension}>
                <td className="whitespace-nowrap">{d.name}</td>
                <td className="text-right font-medium tabular-nums">{d.score}</td>
                {o.previousDims ? <td className="text-right tabular-nums text-ink-muted">{o.previousDims[i]?.score}</td> : null}
                <td className="text-right tabular-nums text-ink-muted">{o.targets[d.dimension] ?? '·'}</td>
                <td className="whitespace-nowrap text-ink-muted">{levelName(d.level)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  ) : null;

  const findings = o.official ? (
    <Section title="Hallazgos">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="onix-label mb-2">Donde los responsables no coinciden</p>
          {o.disagreements.length ? (
            <ul className="space-y-2.5 text-[13px]">
              {o.disagreements.slice(0, 4).map((d) => (
                <li key={d.questionCode}>
                  <p className="text-ink">{o.questionByCode.get(d.questionCode)?.prompt ?? d.questionCode}</p>
                  <p className="text-[12px] text-ink-subtle">
                    {dimName(d.dimension)} · diferencia de {d.delta} niveles
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-muted">Las respuestas coinciden en lo general.</p>
          )}
        </div>
        <div>
          <p className="onix-label mb-2">Puntos ciegos</p>
          <ul className="space-y-1.5 text-[13px] text-ink">
            {o.uncovered.map((f) => (
              <li key={f}>{f}: sin responsable asignado</li>
            ))}
            {Object.entries(o.unknownByDim)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <li key={k}>
                  {dimName(k)}: {v} {v === 1 ? 'respuesta' : 'respuestas'} &quot;No sé&quot;
                </li>
              ))}
            {!o.uncovered.length && !Object.values(o.unknownByDim).some((v) => v > 0) ? (
              <li className="text-ink-muted">Sin puntos ciegos relevantes.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </Section>
  ) : null;

  const inventory = (
    <Section title="Inventario y riesgo">
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-[13px] text-ink-muted">
            {o.cases.length} casos registrados, {o.cases.filter((c) => c.inProduction).length} en producción.
          </p>
          <div className="mt-3">
            <StackBar parts={risks.map((r, i) => ({ label: r, value: o.cases.filter((c) => c.risk === r).length, tone: (i + 1) as 1 | 2 | 3 | 4 }))} />
          </div>
        </div>
        <div>
          <p className="onix-label mb-2">Riesgo alto o inaceptable</p>
          <ul className="space-y-1.5 text-[13px]">
            {high.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="text-ink">{c.name}</span>
                <RiskDot risk={c.risk} />
              </li>
            ))}
            {high.length === 0 ? <li className="text-ink-muted">Ninguno.</li> : null}
          </ul>
        </div>
      </div>
    </Section>
  );

  const priorities = top.length ? (
    <Section title="Prioridades del portafolio">
      <table className="onix-table">
        <thead>
          <tr>
            <th className="w-8">#</th>
            <th>Caso</th>
            <th>Cuadrante</th>
            <th>Riesgo</th>
            <th className="text-right">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          {top.map((p, i) => (
            <tr key={p.c.id}>
              <td className="tabular-nums text-ink-subtle">{i + 1}</td>
              <td>{p.c.name}</td>
              <td className="text-ink-muted">{p.quadrant}</td>
              <td>
                <RiskDot risk={p.c.risk} />
              </td>
              <td className="text-right font-medium tabular-nums">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  ) : null;

  const plan = o.actions.length ? (
    <Section title={kind === 'avance' ? 'Avance por etapa' : 'Plan por etapas'}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {stageRows.map((s) => (
            <MeterRow key={s.name} label={s.name} value={s.pct} suffix="%" hint={`${s.done} de ${s.count} acciones cerradas con evidencia`} />
          ))}
        </div>
        <div>
          <p className="onix-label mb-2">Críticas abiertas</p>
          <ul className="space-y-2 text-[13px]">
            {critical.slice(0, 6).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="text-ink">{a.title}</span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {actionProgress(a)}% · {fmt(a.dueDate)}
                </span>
              </li>
            ))}
            {critical.length === 0 ? <li className="text-ink-muted">Todas cerradas.</li> : null}
          </ul>
        </div>
      </div>
    </Section>
  ) : null;

  const actionsTable = o.actions.length ? (
    <Section title="Detalle de acciones">
      <table className="onix-table">
        <thead>
          <tr>
            <th>Acción</th>
            <th>Dimensión</th>
            <th className="text-right">Avance</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {[...o.actions]
            .sort((x, y) => (x.dueDate ?? '9').localeCompare(y.dueDate ?? '9'))
            .map((a) => (
              <tr key={a.id}>
                <td>
                  {a.title}
                  {a.critical ? <span className="ml-1.5 text-[11px] text-ink-subtle">crítica</span> : null}
                </td>
                <td className="text-ink-muted">{dimName(a.dimension)}</td>
                <td className="text-right tabular-nums">{actionProgress(a)}%</td>
                <td className={o.overdue.some((x) => x.id === a.id) ? 'text-danger' : 'text-ink-muted'}>{fmt(a.dueDate)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </Section>
  ) : null;

  const projection = o.official && o.projection.length ? (
    <Section title="Madurez proyectada">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {o.projection.map((p) => (
          <MeterRow
            key={p.dimension}
            label={dimName(p.dimension)}
            value={p.current}
            projected={p.projected}
            target={p.target}
            hint={p.targetUnreachable ? 'El plan actual no alcanza la meta' : undefined}
          />
        ))}
      </div>
      <p className="mt-4 text-[11px] text-ink-subtle">La proyección suma el avance de cada acción; el nivel oficial solo cambia con la reevaluación.</p>
    </Section>
  ) : null;

  const method = (
    <Section title="Alcance y método">
      <p className="text-[13px] leading-relaxed text-ink-muted">
        {o.respondents.length
          ? `La evaluación reunió las respuestas de ${o.respondents.length} responsables de distintas funciones a un cuestionario de madurez en seis dimensiones. `
          : ''}
        Cada respuesta va de 1 (Inicial) a 4 (Gestionado); el puntaje por dimensión va de 0 a 100 y promedia a quienes contestaron.
        La priorización pondera seis criterios con los pesos que definió la organización. Las acciones se cierran solo con evidencia revisada por el consultor.
      </p>
    </Section>
  );

  return (
    <div className="onix-report space-y-8">
      {header}
      {keyFigures}
      {kind === 'evaluacion' ? (
        <>
          {summaryBlock}
          {maturity}
          {findings}
          {inventory}
          {priorities}
          {plan}
          {method}
        </>
      ) : null}
      {kind === 'direccion' ? (
        <>
          {summaryBlock}
          {maturity}
          {priorities}
          {plan}
        </>
      ) : null}
      {kind === 'avance' ? (
        <>
          {plan}
          {projection}
          {actionsTable}
          {summaryBlock}
        </>
      ) : null}
      <p className="border-t border-border pt-4 text-[11px] leading-relaxed text-ink-subtle">{note}</p>
    </div>
  );
}
