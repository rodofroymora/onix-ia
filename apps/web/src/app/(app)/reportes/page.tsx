import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui/PageHeader';
import { createReportAction } from '@/lib/actions/reports';
import { REPORT_KINDS, reportKind, type ReportKind } from '@/lib/report-kinds';
import { loadReports } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

export default async function ReportesPage() {
  const session = await requireSession();
  const reports = await loadReports(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';

  return (
    <div>
      <PageHeader
        eyebrow="Entregables"
        title="Reportes"
        description="Informes listos para compartir. Las cifras salen de la plataforma; el resumen lo redacta el asistente y tú lo editas."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.entries(REPORT_KINDS) as [ReportKind, (typeof REPORT_KINDS)[ReportKind]][]).map(([k, v]) => (
          <div key={k} className="onix-panel flex flex-col px-5 py-5">
            <FileText className="h-5 w-5 text-ink-subtle" strokeWidth={1.5} />
            <p className="mt-3 text-[15px] font-medium text-ink">{v.n}</p>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-ink-muted">{v.d}</p>
            {canWrite ? (
              <form action={createReportAction} className="mt-4">
                <input type="hidden" name="kind" value={k} />
                <button className="onix-btn-ghost w-full">Generar</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>

      <Card title="Informes generados" className="mt-6">
        {reports.length ? (
          <ul className="-mx-1 divide-y divide-border">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={`/reportes/${r.id}`} className="flex items-center justify-between gap-4 rounded-md px-1 py-3 text-[14px] hover:bg-canvas-subtle/60">
                  <span className="min-w-0 truncate text-ink">{r.title}</span>
                  <span className="flex shrink-0 items-center gap-4 text-[12px] text-ink-subtle">
                    <span>{REPORT_KINDS[reportKind(r.kind)].n}</span>
                    <span className="tabular-nums">
                      {new Date(r.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-muted">Aún no hay informes. Genera el primero arriba.</p>
        )}
      </Card>
    </div>
  );
}
