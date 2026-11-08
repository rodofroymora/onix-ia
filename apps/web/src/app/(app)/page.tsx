import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DIMS, levelName } from '@onix/engine';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskDot } from '@/components/ui/RiskDot';
import { loadDashboard } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

export default async function HomePage() {
  const session = await requireSession();
  const data = await loadDashboard(session.user.organizationId);

  const nextStep = !data.assessment
    ? { href: '/evaluacion', label: 'Lanza tu Revisión inicial' }
    : data.assessment.status !== 'completed'
      ? { href: '/evaluacion', label: 'Continúa la evaluación' }
      : data.actions.length === 0
        ? { href: '/plan', label: 'Arma el plan desde la biblioteca' }
        : { href: '/plan', label: 'Revisa el avance del plan' };

  const done = data.actions.filter((a) => a.progress === '100').length;
  const progressPct = data.actions.length
    ? Math.round((done / data.actions.length) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="Inicio"
        description={`Tablero ejecutivo — ${session.user.organizationName}. Orientativo; no constituye certificación.`}
        actions={
          <Link href={nextStep.href} className="onix-btn-primary">
            {nextStep.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="onix-panel p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-ink-muted">Madurez oficial</h2>
          {data.assessment?.status === 'completed' ? (
            <>
              <p className="mt-3 font-display text-4xl text-ink">{data.assessment.globalScore ?? '—'}</p>
              <p className="text-sm text-ink-muted">
                Nivel {data.assessment.globalLevel} ·{' '}
                {data.assessment.globalLevel ? levelName(data.assessment.globalLevel) : '—'}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {DIMS.map((dim) => {
                  const row = data.dims.find((d) => d.dimension === dim.k);
                  return (
                    <div key={dim.k} className="rounded-md border border-border px-3 py-2">
                      <p className="text-xs text-ink-subtle">{dim.n}</p>
                      <p className="text-lg text-ink">{row?.score ?? '—'}</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              Aún no hay madurez oficial publicada. Publica la evaluación para calcularla con el motor.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div className="onix-panel p-5">
            <h2 className="text-sm font-medium text-ink-muted">Plan</h2>
            <p className="mt-3 font-display text-3xl text-ink">{progressPct}%</p>
            <p className="text-xs text-ink-subtle">
              {done} de {data.actions.length} acciones cerradas
            </p>
          </div>
          <div className="onix-panel p-5">
            <h2 className="text-sm font-medium text-ink-muted">Inventario</h2>
            <ul className="mt-3 space-y-2">
              {data.cases.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{c.name}</span>
                  <RiskDot risk={c.risk} />
                </li>
              ))}
              {data.cases.length === 0 ? (
                <li className="text-sm text-ink-muted">Sin casos aún.</li>
              ) : null}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
