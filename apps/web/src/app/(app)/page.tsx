import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { DIMS, levelName } from '@onix/engine';
import { TrendChart } from '@/components/charts/TrendChart';
import { mxn, summarizeUsage } from '@/lib/server/telemetry';
import { MeterRow, RadarChart, Ring, SeriesKey, StackBar } from '@/components/charts';
import { Card, Empty, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { actionProgress, loadOrgOverview } from '@/lib/server/insights';
import { requireSession } from '@/lib/session';

export default async function HomePage() {
  const session = await requireSession();
  const o = await loadOrgOverview(session.user.organizationId);
  const first = session.user.name?.split(' ')[0] ?? '';

  const nextStep = !o.official
    ? o.current
      ? { href: '/evaluacion', label: 'Continuar la evaluación' }
      : { href: '/evaluacion', label: 'Lanzar la Revisión inicial' }
    : o.cases.length === 0
      ? { href: '/inventario', label: 'Registrar casos de IA' }
      : o.actions.length === 0
        ? { href: '/plan', label: 'Armar el plan' }
        : { href: '/plan?tab=backlog', label: 'Ver acciones pendientes' };

  if (!o.official) {
    return (
      <div>
        <PageHeader eyebrow={session.user.organizationName} title={`Hola, ${first}`} description="Todavía no hay una evaluación publicada." />
        <Empty title="Empieza por la Revisión inicial">
          <p>Invita a tres a cinco responsables y en unos días tendrás tu nivel por dimensión.</p>
          <Link href={nextStep.href} className="onix-btn-primary mt-4">
            {nextStep.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </Empty>
      </div>
    );
  }

  const g = o.official.globalScore ?? 0;
  const prevG = o.previous?.globalScore ?? null;
  const delta = prevG != null ? g - prevG : null;
  const high = o.cases.filter((c) => c.risk === 'Alto' || c.risk === 'Inaceptable');
  const blind = Object.values(o.unknownByDim).reduce((t, v) => t + v, 0);
  const axes = o.officialDims.map((d) => ({ label: d.lines }));
  const series = [
    ...(o.previousDims ? [{ name: 'Anterior', values: o.previousDims.map((d) => d.score), style: 'outline' as const }] : []),
    { name: 'Meta', values: DIMS.map((d) => o.targets[d.k] ?? 0), style: 'dashed' as const },
    { name: 'Actual', values: o.officialDims.map((d) => d.score), style: 'solid' as const },
  ];
  const tel = summarizeUsage(o.usage);
  const top = o.prioritized.filter((p) => !p.blocked && p.score != null).slice(0, 5);
  const stageProgress = o.stages.map((s) => {
    const acts = o.actions.filter((a) => a.stageId === s.id);
    const pct = acts.length ? Math.round(acts.reduce((t, a) => t + actionProgress(a), 0) / acts.length) : 0;
    return { name: s.name, pct, count: acts.length, done: acts.filter((a) => actionProgress(a) === 100).length };
  });
  const risks = ['Bajo', 'Medio', 'Alto', 'Inaceptable'].map((r, i) => ({
    label: r,
    value: o.cases.filter((c) => c.risk === r).length,
    tone: ((i + 1) as 1 | 2 | 3 | 4),
  }));
  const statuses = ['Aprobado', 'En revisión', 'Propuesto', 'Descartado'].map((st, i) => ({
    label: st,
    value: o.cases.filter((c) => c.status === st).length,
    tone: (i === 3 ? ('neutral' as const) : ((4 - i) as 2 | 3 | 4)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={session.user.organizationName}
        title={`Hola, ${first}`}
        description={`Así va el gobierno de IA, con datos de la ${o.official.title.toLowerCase()} y el plan al día de hoy.`}
        actions={
          <>
            <Link href="/reportes" className="onix-btn-ghost">
              Reportes
            </Link>
            <Link href={nextStep.href} className="onix-btn-primary">
              {nextStep.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi
          label="Madurez global"
          value={
            <>
              {g}
              <span className="text-[15px] font-normal text-ink-subtle"> /100</span>
            </>
          }
          sub={
            <>
              {levelName(o.official.globalLevel ?? 1)}
              {delta != null ? (
                <span className={delta >= 0 ? 'text-success' : 'text-danger'}>
                  {' '}
                  · {delta >= 0 ? '+' : ''}
                  {delta} vs. anterior
                </span>
              ) : null}
            </>
          }
        />
        <div className="onix-panel flex items-center justify-between px-5 py-4">
          <div>
            <p className="onix-card-title">Avance del plan</p>
            <p className="mt-2 text-[12px] text-ink-subtle">
              {o.actions.filter((a) => actionProgress(a) === 100).length} de {o.actions.length} acciones cerradas
            </p>
            {o.overdue.length ? <p className="mt-0.5 text-[12px] text-danger">{o.overdue.length} vencidas</p> : null}
          </div>
          <Ring value={o.planPct} size={64} />
        </div>
        <Kpi label="Casos de IA" value={o.cases.length} sub={`${high.length} de riesgo alto o inaceptable`} />
        <Kpi label="Por aclarar" value={o.disagreements.length} sub={`desacuerdos · ${blind} "No sé" · ${o.uncovered.length} funciones sin responsable`} />
      </div>

      {o.nextReevaluation && o.nextReevaluation.daysLeft <= 30 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3.5 text-[13px]">
          <span className="text-ink">
            {o.nextReevaluation.daysLeft >= 0
              ? `La reevaluación toca en ${o.nextReevaluation.daysLeft} días.`
              : `La reevaluación venció hace ${-o.nextReevaluation.daysLeft} días.`}{' '}
            <span className="text-ink-muted">Se programa cada {o.nextReevaluation.months} meses.</span>
          </span>
          <Link href="/evaluacion" className="onix-btn-ghost py-1.5">
            Lanzar reevaluación
          </Link>
        </div>
      ) : null}

      {tel.last ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card
            title="Uso de IA"
            className="lg:col-span-3"
            aside={
              <Link href="/telemetria" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
                Telemetría <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <TrendChart
              labels={tel.monthly.map((m) => m.label)}
              series={[
                { name: 'Solicitudes en herramientas autorizadas', values: tel.monthly.map((m) => m.sanctionedRequests), tone: 'solid' },
                { name: 'Uso no autorizado', values: tel.monthly.map((m) => m.shadowRequests), tone: 'muted' },
              ]}
              height={190}
            />
          </Card>
          <Card title={`Este mes · ${tel.last.label}`} className="lg:col-span-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              {[
                ['Usuarios activos', tel.last.users.toLocaleString('es-MX'), tel.change.users],
                ['Solicitudes', tel.last.requests.toLocaleString('es-MX'), tel.change.requests],
                ['Costo MXN', mxn(tel.last.cost), tel.change.cost],
                ['Uso no autorizado', `${tel.shadowShare}%`, null],
              ].map(([l, v, c]) => (
                <div key={String(l)}>
                  <dt className="text-[11px] text-ink-subtle">{l}</dt>
                  <dd className="mt-1 text-[20px] font-semibold tabular-nums leading-none text-ink">{v}</dd>
                  {c != null ? <dd className="mt-1 text-[11px] text-ink-subtle">{`${Number(c) >= 0 ? '+' : ''}${c}% vs. mes anterior`}</dd> : null}
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[13px]">
              <span className="text-ink-muted">
                {o.agents.length} agentes · {o.agents.filter((a) => !a.managed).length} sin gestionar · {o.agents.filter((a) => !a.ownerName).length} sin dueño
              </span>
              <Link href="/agentes" className="text-accent hover:underline">
                Ver mapa
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          title="Madurez por dimensión"
          className="lg:col-span-3"
          aside={
            <Link href="/evaluacion?tab=resultados" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
              Detalle <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="mx-auto max-w-[440px]">
            <RadarChart axes={axes} series={series} />
          </div>
          <div className="mt-2 flex justify-center">
            <SeriesKey
              items={[
                { label: 'Actual', style: 'solid' },
                ...(o.previousDims ? [{ label: 'Evaluación anterior', style: 'outline' as const }] : []),
                { label: 'Meta', style: 'dashed' },
              ]}
            />
          </div>
        </Card>
        <Card title="Hacia la meta" className="lg:col-span-2" aside={<span className="onix-chip">actual → proyectado / meta</span>}>
          <div className="space-y-4">
            {o.projection.map((p) => {
              const d = o.officialDims.find((x) => x.dimension === p.dimension)!;
              return (
                <MeterRow
                  key={p.dimension}
                  label={d.name}
                  value={p.current}
                  projected={p.projected}
                  target={p.target}
                  hint={p.targetUnreachable ? 'El plan actual no alcanza la meta' : undefined}
                />
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">
            {o.capas.map((c) => (
              <div key={c.capa}>
                <p className="text-[11px] text-ink-subtle">{c.capa}</p>
                <p className="text-[18px] font-semibold tabular-nums text-ink">{c.score}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          title="Prioridades del portafolio"
          className="lg:col-span-3"
          aside={
            <Link href="/priorizacion" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
              Matriz <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <table className="onix-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Cuadrante</th>
                <th>Riesgo</th>
                <th className="text-right">Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.c.id}>
                  <td>
                    <Link href={`/inventario?caso=${p.c.id}`} className="hover:underline">
                      {p.c.name}
                    </Link>
                  </td>
                  <td className="text-ink-muted">{p.quadrant}</td>
                  <td>
                    <RiskDot risk={p.c.risk} />
                  </td>
                  <td className="text-right tabular-nums">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card
          title="Plan por etapa"
          className="lg:col-span-2"
          aside={
            <Link href="/plan" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
              Plan <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="space-y-4">
            {stageProgress.map((s) => (
              <MeterRow key={s.name} label={s.name} value={s.pct} suffix="%" hint={`${s.done} de ${s.count} acciones cerradas`} />
            ))}
          </div>
          {o.overdue.length ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="onix-label mb-2">Vencidas</p>
              <ul className="space-y-1.5">
                {o.overdue.slice(0, 3).map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate text-ink">{a.title}</span>
                    <span className="shrink-0 tabular-nums text-ink-subtle">{a.progress}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <Card
        title="Inventario de IA"
        aside={
          <Link href="/inventario" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
            Inventario <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="onix-label mb-2">Por riesgo</p>
            <StackBar parts={risks} />
          </div>
          <div>
            <p className="onix-label mb-2">Por estatus</p>
            <StackBar parts={statuses} />
          </div>
        </div>
      </Card>

      <p className="text-[11px] text-ink-subtle">
        Revisión orientativa con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador.
      </p>
    </div>
  );
}
