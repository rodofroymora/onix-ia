import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { answers, assessments, invitations, organizations, questions } from '@onix/db';
import { DIMS } from '@onix/engine';
import { DIMENSION_INTROS, dimsForFunctions, maturityForRoute } from '@onix/templates';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { consumeInvitationAction, saveRespondentAnswerAction } from '@/lib/actions/assessments';
import { getDb, withOrg } from '@/lib/db';
import { verifyRespondentToken } from '@/lib/respondent-token';

function Shell({ children, org, who }: { children: React.ReactNode; org?: string; who?: string | null }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-canvas">Ó</span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-ink">Revisión de gobierno de IA{org ? ` · ${org}` : ''}</p>
            <p className="truncate text-[12px] text-ink-subtle">{who ? `Contesta: ${who}` : 'Ónix Govern'}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-[22px] font-semibold tracking-tight text-ink">{title}</p>
        <div className="mt-2 text-[14px] leading-relaxed text-ink-muted">{children}</div>
      </div>
    </Shell>
  );
}

export default async function RespondentPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ dim?: string; done?: string; desde?: string; falta?: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const sp = await searchParams;
  const fromApp = sp.desde === 'app';

  if (sp.done === '1') {
    return (
      <Message title="Gracias, ya quedó">
        <p>Tus respuestas se enviaron. El resultado general aparece cuando contesta todo el equipo y se publica la evaluación.</p>
        {fromApp ? (
          <Link href="/evaluacion?tab=seguimiento" className="onix-btn-primary mt-6">
            Volver a la evaluación
          </Link>
        ) : null}
      </Message>
    );
  }

  const payload = verifyRespondentToken(token);
  if (!payload) notFound();

  const { db } = getDb();
  const data = await withOrg(db, payload.organizationId, async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, payload.invitationId), eq(invitations.organizationId, payload.organizationId)))
      .limit(1);
    const [assessment] = await tx
      .select()
      .from(assessments)
      .where(and(eq(assessments.id, payload.assessmentId), eq(assessments.organizationId, payload.organizationId)))
      .limit(1);
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, payload.organizationId)).limit(1);
    const mine = await tx
      .select()
      .from(answers)
      .where(and(eq(answers.assessmentId, payload.assessmentId), eq(answers.invitationId, payload.invitationId)));
    return { inv, assessment, orgName: org?.name ?? '', mine };
  });
  const { inv, assessment, orgName, mine } = data;
  if (!inv || !assessment || inv.assessmentId !== payload.assessmentId) notFound();

  if (inv.status !== 'pending') {
    return (
      <Message title="Este enlace ya se usó">
        <p>Las respuestas de este enlace ya se enviaron o la invitación se cerró. Si te falta contestar, pide una nueva invitación.</p>
      </Message>
    );
  }
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
    return (
      <Message title="La invitación venció">
        <p>Pide a quien te invitó que te mande un enlace nuevo.</p>
      </Message>
    );
  }

  const qs = await db.select().from(questions).where(eq(questions.questionnaireVersionId, assessment.questionnaireVersionId));
  const routeCodes = new Set(maturityForRoute(((assessment.saasRoute ?? 38) as 15 | 27 | 38)).map((q) => q.code));
  const fns = Array.isArray(inv.functions) ? (inv.functions as string[]) : [];
  const myDims = fns.length ? new Set<string>(dimsForFunctions(fns)) : null;
  const routeQs = qs
    .filter((q) => q.kind === 'maturity' && q.dimension && routeCodes.has(q.code))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const mineQs = routeQs.filter((q) => !myDims || myDims.has(q.dimension!));
  const answered = new Map(mine.map((a) => [a.questionId, a.valueText === 'no_se' ? 'no_se' : String(a.valueInt)]));
  const dims = DIMS.map((d) => {
    const list = mineQs.filter((q) => q.dimension === d.k);
    return { ...d, qs: list, done: list.filter((q) => answered.has(q.id)).length, applies: list.length > 0 };
  });
  const total = mineQs.length;
  const doneAll = mineQs.filter((q) => answered.has(q.id)).length;
  const expected = total;
  const base = `/r/${encodeURIComponent(token)}`;
  const keep = fromApp ? '&desde=app' : '';
  const qsKeep = fromApp ? '?desde=app' : '';

  async function saveDimension(formData: FormData) {
    'use server';
    const tok = String(formData.get('token'));
    const ids = formData.getAll('qid').map(String);
    for (const id of ids) {
      const v = String(formData.get(`q:${id}`) ?? '');
      if (!v) continue;
      if (v === 'no_se') await saveRespondentAnswerAction({ token: tok, questionId: id, valueInt: null, valueText: 'no_se' });
      else await saveRespondentAnswerAction({ token: tok, questionId: id, valueInt: Number(v), valueText: null });
    }
    const next = String(formData.get('next') ?? '');
    const from = String(formData.get('from') ?? '');
    const suffix = from === 'app' ? 'desde=app' : '';
    redirect(`/r/${encodeURIComponent(tok)}${next ? `?dim=${next}${suffix ? `&${suffix}` : ''}` : suffix ? `?${suffix}` : ''}`);
  }

  async function finish(formData: FormData) {
    'use server';
    const tok = String(formData.get('token'));
    const p2 = verifyRespondentToken(tok);
    if (!p2) notFound();
    const got = await withOrg(getDb().db, p2.organizationId, (tx) =>
      tx.select({ id: answers.id }).from(answers).where(and(eq(answers.assessmentId, p2.assessmentId), eq(answers.invitationId, p2.invitationId))),
    );
    if (got.length < expected) redirect(`/r/${encodeURIComponent(tok)}?falta=1`);
    await consumeInvitationAction(tok);
    const from = String(formData.get('from') ?? '');
    redirect(`/r/${encodeURIComponent(tok)}?done=1${from === 'app' ? '&desde=app' : ''}`);
  }

  // ---------------------------------------------------------------- Una dimensión
  const current = sp.dim ? dims.find((d) => d.k === sp.dim && d.applies) : null;
  if (current) {
    const order = dims.filter((d) => d.applies);
    const next = order[order.findIndex((d) => d.k === current.k) + 1];
    return (
      <Shell org={orgName} who={inv.respondentName ?? inv.email}>
        <Link href={`${base}${qsKeep}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Todas las dimensiones
        </Link>
        <div className="mt-4">
          <p className="onix-label">{current.capa}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">{current.n}</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-muted">{DIMENSION_INTROS[current.k]}</p>
        </div>
        <form action={saveDimension} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="from" value={fromApp ? 'app' : ''} />
          {current.qs.map((q, i) => {
            const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
            const val = answered.get(q.id);
            return (
              <fieldset key={q.id} className="onix-panel px-5 py-5">
                <input type="hidden" name="qid" value={q.id} />
                <legend className="sr-only">{q.prompt}</legend>
                <p className="text-[15px] font-medium leading-snug text-ink">
                  <span className="mr-2 tabular-nums text-ink-subtle">{i + 1}.</span>
                  {q.prompt}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {opts.map((opt, j) => (
                    <label key={j} className="cursor-pointer">
                      <input type="radio" name={`q:${q.id}`} value={String(j + 1)} defaultChecked={val === String(j + 1)} className="peer sr-only" />
                      <span className="flex h-full items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-[13px] leading-snug text-ink transition hover:border-border-strong peer-checked:border-accent peer-checked:bg-[color-mix(in_srgb,var(--onix-accent)_8%,transparent)]">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] tabular-nums text-ink-muted">{j + 1}</span>
                        {opt}
                      </span>
                    </label>
                  ))}
                  <label className="cursor-pointer sm:col-span-2">
                    <input type="radio" name={`q:${q.id}`} value="no_se" defaultChecked={val === 'no_se'} className="peer sr-only" />
                    <span className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3.5 py-2.5 text-[13px] text-ink-muted transition peer-checked:border-ink peer-checked:text-ink">
                      No sé (también ayuda: se registra como punto a aclarar)
                    </span>
                  </label>
                </div>
              </fieldset>
            );
          })}
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-canvas/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
            <span className="text-[12px] text-ink-subtle">Se guarda al continuar; puedes regresar y cambiar tus respuestas.</span>
            <div className="flex gap-2">
              <button name="next" value="" className="onix-btn-ghost">
                Guardar y volver
              </button>
              {next ? (
                <button name="next" value={next.k} className="onix-btn-primary">
                  Guardar y seguir con {next.n}
                </button>
              ) : (
                <button name="next" value="" className="onix-btn-primary">
                  Guardar
                </button>
              )}
            </div>
          </div>
        </form>
      </Shell>
    );
  }

  // ---------------------------------------------------------------- Panel de dimensiones
  const pct = total ? Math.round((doneAll / total) * 100) : 0;
  return (
    <Shell org={orgName} who={inv.respondentName ?? inv.email}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Hola{inv.respondentName ? `, ${inv.respondentName.split(' ')[0]}` : ''}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Estas preguntas miden qué tan preparada está {orgName || 'la empresa'} para usar IA con orden. Contesta lo que ves en tu día a día; no hay respuestas buenas ni malas. Son {total} preguntas, unos {Math.max(5, Math.round(total * 0.4))} minutos.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[32px] font-semibold tabular-nums leading-none text-ink">{pct}%</p>
          <p className="mt-1 text-[12px] text-ink-subtle">
            {doneAll} de {total} contestadas
          </p>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas-subtle">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {sp.falta ? <p className="mt-3 text-[13px] text-danger">Aún faltan preguntas por contestar.</p> : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dims.map((d) =>
          d.applies ? (
            <Link key={d.k} href={`${base}?dim=${d.k}${keep}`} className="onix-panel group flex flex-col px-5 py-5 transition hover:border-border-strong">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{d.capa}</p>
                {d.done === d.qs.length ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-canvas">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[16px] font-semibold text-ink">{d.n}</p>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-ink-muted">{DIMENSION_INTROS[d.k]}</p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-canvas-subtle">
                <div className="h-full bg-accent" style={{ width: `${(d.done / d.qs.length) * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px]">
                <span className="tabular-nums text-ink-subtle">
                  {d.done} de {d.qs.length} preguntas
                </span>
                <span className="font-medium text-accent">{d.done === 0 ? 'Empezar' : d.done === d.qs.length ? 'Revisar' : 'Continuar'}</span>
              </div>
            </Link>
          ) : (
            <div key={d.k} className="flex flex-col rounded-xl border border-dashed border-border px-5 py-5 opacity-60">
              <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{d.capa}</p>
              <p className="mt-2 text-[16px] font-semibold text-ink">{d.n}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{DIMENSION_INTROS[d.k]}</p>
              <p className="mt-4 text-[12px] text-ink-subtle">La contesta otra área</p>
            </div>
          ),
        )}
      </div>

      <form action={finish} className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="from" value={fromApp ? 'app' : ''} />
        <p className="text-[13px] text-ink-muted">
          {doneAll < total ? `Te faltan ${total - doneAll} preguntas. Puedes enviar cuando termines.` : 'Listo. Revisa si quieres y envía tus respuestas.'}
        </p>
        <button className="onix-btn-primary" disabled={doneAll < total}>
          Enviar respuestas
        </button>
      </form>
      <p className="mt-6 text-center text-[11px] text-ink-subtle">
        Revisión orientativa con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador.
      </p>
    </Shell>
  );
}
