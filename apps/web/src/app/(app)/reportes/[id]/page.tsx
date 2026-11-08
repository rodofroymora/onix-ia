import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { ReportDocument } from '@/components/reports/ReportDocument';
import { redraftReportAction, refreshReportSnapshotAction, updateReportDraftAction } from '@/lib/actions/reports';
import { reportKind } from '@/lib/report-kinds';
import { loadOrgOverview } from '@/lib/server/insights';
import { fromSnapshot, type ReportSnapshot } from '@/lib/server/report-snapshot';
import { loadReport } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

type Payload = { body?: string; note?: string; bodySource?: string };

export default async function ReportEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const report = await loadReport(session.user.organizationId, id);
  if (!report) notFound();
  const snap = (report.payload as { snapshot?: ReportSnapshot }).snapshot;
  const o = snap ? fromSnapshot(snap) : await loadOrgOverview(session.user.organizationId);
  const payload = report.payload as Payload;
  const canWrite = session.user.role !== 'client_reader';
  const date = new Date(snap?.takenAt ?? report.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const sourceLabel =
    payload.bodySource === 'llm' ? 'Sugerencia del Asistente Ónix' : payload.bodySource === 'editado' ? 'Editado por tu equipo' : 'Sugerencia armada con los datos';

  const summary = canWrite ? (
    <form action={updateReportDraftAction} className="print:hidden">
      <input type="hidden" name="reportId" value={report.id} />
      <input type="hidden" name="title" value={report.title} />
      <textarea className="onix-input min-h-[160px] text-[14px] leading-relaxed" name="body" defaultValue={payload.body ?? ''} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-ink-subtle">{sourceLabel}. Revísalo antes de compartir.</span>
        <div className="flex gap-2">
          <button formAction={redraftReportAction} className="onix-btn-ghost py-1.5">
            Volver a redactar
          </button>
          <button className="onix-btn-primary py-1.5">Guardar</button>
        </div>
      </div>
    </form>
  ) : (
    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{payload.body}</p>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/reportes" className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Reportes
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-subtle">
            {snap ? `Cifras al ${new Date(snap.takenAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Cifras en vivo'}
          </span>
          {canWrite ? (
            <form action={refreshReportSnapshotAction}>
              <input type="hidden" name="reportId" value={report.id} />
              <button className="onix-btn-ghost">Actualizar cifras</button>
            </form>
          ) : null}
          <a href={`/print/reportes/${report.id}`} target="_blank" rel="noopener" className="onix-btn-primary">
            <Printer className="h-4 w-4" /> Imprimir o guardar PDF
          </a>
        </div>
      </div>
      <article className="onix-panel mx-auto max-w-4xl px-6 py-8 sm:px-10">
        <ReportDocument
          kind={reportKind(report.kind)}
          o={o}
          orgName={session.user.organizationName ?? ''}
          title={report.title}
          date={date}
          summary={summary}
          note={payload.note ?? ''}
        />
      </article>
    </div>
  );
}
