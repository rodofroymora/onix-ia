'use client';

type Question = {
  id: string;
  prompt: string;
  options: unknown;
};

export function RespondentWizard({
  token,
  organizationId,
  assessmentId,
  invitationId,
  question,
  qIndex,
  total,
  currentValue,
  saveAction,
}: {
  token: string;
  organizationId: string;
  assessmentId: string;
  invitationId: string;
  question: Question;
  qIndex: number;
  total: number;
  currentValue: number | 'no_se' | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const options = Array.isArray(question.options) ? (question.options as string[]) : [];
  const progress = total > 0 ? Math.round(((qIndex + 1) / total) * 100) : 0;
  const isLast = qIndex >= total - 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
      <div className="mb-6">
        <p className="font-display text-xl text-ink">Ónix Govern</p>
        <p className="text-xs text-ink-subtle">Portal de respuesta · una pregunta por pantalla</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas-subtle">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {qIndex + 1} de {total}
        </p>
      </div>

      <form action={saveAction} className="onix-panel flex flex-1 flex-col p-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="invitationId" value={invitationId} />
        <input type="hidden" name="questionId" value={question.id} />
        <input type="hidden" name="qIndex" value={qIndex} />

        <h1 className="text-lg text-ink">{question.prompt}</h1>

        <fieldset className="mt-5 space-y-2">
          {options.map((opt, i) => {
            const value = String(i + 1);
            return (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 text-sm hover:bg-canvas-subtle"
              >
                <input
                  type="radio"
                  name="choice"
                  value={value}
                  required
                  defaultChecked={currentValue === i + 1}
                  className="mt-1"
                />
                <span className="text-ink">{opt}</span>
              </label>
            );
          })}
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-dashed border-border px-3 py-3 text-sm hover:bg-canvas-subtle">
            <input
              type="radio"
              name="choice"
              value="no_se"
              defaultChecked={currentValue === 'no_se'}
              className="mt-1"
            />
            <span className="text-ink-muted">No sé — se registra como hallazgo</span>
          </label>
        </fieldset>

        <div className="mt-auto flex flex-wrap gap-2 pt-8">
          {qIndex > 0 ? (
            <button type="submit" name="next" value="prev" className="onix-btn-ghost" formNoValidate>
              Anterior
            </button>
          ) : null}
          {isLast ? (
            <button type="submit" name="next" value="finish" className="onix-btn-primary ml-auto">
              Enviar
            </button>
          ) : (
            <button type="submit" name="next" value="next" className="onix-btn-primary ml-auto">
              Siguiente
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
