import Link from 'next/link';

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-canvas">Ó</span>
          <Link href="/login" className="text-[14px] font-medium text-ink">
            Ónix Govern
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-subtle">Última actualización: {updated}</p>
        <div className="onix-legal mt-8 space-y-6 text-[14.5px] leading-relaxed text-ink">{children}</div>
        <p className="mt-12 text-[12px] text-ink-subtle">
          <Link href="/privacidad" className="hover:underline">Aviso de privacidad</Link> · <Link href="/terminos" className="hover:underline">Términos de uso</Link> · <Link href="/login" className="hover:underline">Entrar</Link>
        </p>
      </main>
    </div>
  );
}
