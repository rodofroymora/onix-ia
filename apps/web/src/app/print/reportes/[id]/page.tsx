import { notFound } from 'next/navigation';
import { ReportDocument } from '@/components/reports/ReportDocument';
import { reportKind } from '@/lib/report-kinds';
import { loadOrgOverview } from '@/lib/server/insights';
import { loadReport } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

export default async function ReportPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const report = await loadReport(session.user.organizationId, id);
  if (!report) notFound();
  const o = await loadOrgOverview(session.user.organizationId);
  const payload = report.payload as { body?: string; note?: string };
  const date = new Date(report.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div data-theme="light" className="min-h-screen bg-white">
      <script
        dangerouslySetInnerHTML={{
          __html:
            'document.documentElement.dataset.theme="light";window.addEventListener("load",()=>setTimeout(()=>window.print(),400))',
        }}
      />
      <style>{'@page{size:letter;margin:16mm 14mm} body{background:#fff}'}</style>
      <div className="mx-auto max-w-[820px] px-8 py-10 print:max-w-none print:p-0">
        <ReportDocument
          kind={reportKind(report.kind)}
          o={o}
          orgName={session.user.organizationName ?? ''}
          title={report.title}
          date={date}
          summary={<p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{payload.body}</p>}
          note={payload.note ?? ''}
        />
      </div>
    </div>
  );
}
