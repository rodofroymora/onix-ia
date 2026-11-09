export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="onix-label mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-display text-[24px] font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  aside,
  children,
  className = '',
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`onix-panel p-5 ${className}`}>
      {title || aside ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="onix-card-title">{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="onix-panel min-w-0 px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="onix-card-title">{label}</p>
      <p className="onix-kpi mt-2">{value}</p>
      {sub ? <p className="mt-1.5 text-[12px] text-ink-subtle">{sub}</p> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {children ? <div className="mt-1.5 text-[13px] text-ink-muted">{children}</div> : null}
    </div>
  );
}
