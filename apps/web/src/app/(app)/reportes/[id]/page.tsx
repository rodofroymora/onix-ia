import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  draftReportWithAssistantAction,
  updateReportDraftAction,
} from '@/lib/actions/reports';
import { FEATURES } from '@/lib/features';
import { loadReport } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

export default async function ReportEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const report = await loadReport(session.user.organizationId, id);
  if (!report) notFound();
  const payload = report.payload as {
    body?: string;
    note?: string;
    globalScore?: number;
    globalLevel?: number;
  };
  const canWrite = session.user.role !== 'client_reader';

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-canvas">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/reportes" className="onix-btn-ghost">
            Volver
          </Link>
          <div className="flex gap-2">
            {FEATURES.assistant && canWrite ? (
              <form action={draftReportWithAssistantAction}>
                <input type="hidden" name="reportId" value={report.id} />
                <button type="submit" className="onix-btn-ghost">
                  Borrador con asistente
                </button>
              </form>
            ) : null}
            <a href={`/print/reportes/${report.id}`} className="onix-btn-primary" target="_blank">
              Vista impresión / PDF
            </a>
          </div>
        </div>

        <article className="onix-panel flex-1 p-8">
          <p className="font-display text-2xl text-ink">Ónix Govern</p>
          <h1 className="mt-2 text-xl text-ink">{report.title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{payload.note}</p>
          <p className="mt-4 text-sm text-ink">
            Puntaje global: {payload.globalScore ?? '—'} · Nivel {payload.globalLevel ?? '—'}
          </p>
          {canWrite ? (
            <form action={updateReportDraftAction} className="mt-6">
              <input type="hidden" name="reportId" value={report.id} />
              <textarea
                className="onix-input min-h-[280px]"
                name="body"
                defaultValue={payload.body ?? ''}
              />
              <button type="submit" className="onix-btn-primary mt-3">
                Guardar borrador
              </button>
            </form>
          ) : (
            <div className="mt-6 whitespace-pre-wrap text-sm text-ink">{payload.body}</div>
          )}
        </article>
      </div>
    </div>
  );
}
