import Link from 'next/link';
import { createReportAction } from '@/lib/actions/reports';
import { loadReports } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function ReportesPage() {
  const session = await requireSession();
  const reports = await loadReports(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';

  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Informes de Revisión inicial. Exportación vía vista de impresión HTML."
        actions={
          canWrite ? (
            <form action={createReportAction}>
              <input type="hidden" name="title" value="Informe de Revisión inicial" />
              <button type="submit" className="onix-btn-primary">
                Nuevo informe
              </button>
            </form>
          ) : null
        }
      />
      <ul className="divide-y divide-border onix-panel">
        {reports.map((r) => (
          <li key={r.id}>
            <Link
              href={`/reportes/${r.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-canvas-subtle"
            >
              <span className="text-ink">{r.title}</span>
              <span className="text-xs text-ink-subtle">{r.kind}</span>
            </Link>
          </li>
        ))}
        {reports.length === 0 ? (
          <li className="px-4 py-6 text-sm text-ink-muted">Aún no hay informes.</li>
        ) : null}
      </ul>
    </div>
  );
}
