import { notFound } from 'next/navigation';
import { loadReport } from '@/lib/server/org-data';
import { requireSession } from '@/lib/session';

export default async function ReportPrintPage({
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

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-black print:p-0">
      <script
        dangerouslySetInnerHTML={{
          __html: 'window.addEventListener("load",()=>setTimeout(()=>window.print(),250))',
        }}
      />
      <p className="text-sm uppercase tracking-wide text-neutral-500">Ónix Govern</p>
      <h1 className="mt-2 text-2xl font-semibold">{report.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{payload.note}</p>
      <p className="mt-4 text-sm">
        Organización: {session.user.organizationName}
        <br />
        Puntaje: {payload.globalScore ?? '—'} · Nivel {payload.globalLevel ?? '—'}
      </p>
      <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed">{payload.body}</div>
      <p className="mt-10 text-xs text-neutral-500">
        Revisión inicial orientativa. No constituye certificación ni dictamen legal.
      </p>
    </div>
  );
}
