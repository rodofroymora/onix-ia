export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-[20px] font-semibold text-canvas">Ó</span>
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-[14px] text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="mt-8">{children}</div>
        <p className="mt-8 text-center text-[11px] text-ink-subtle">
          <a href="/privacidad" className="hover:underline">Aviso de privacidad</a> · <a href="/terminos" className="hover:underline">Términos de uso</a>
        </p>
      </div>
    </div>
  );
}
