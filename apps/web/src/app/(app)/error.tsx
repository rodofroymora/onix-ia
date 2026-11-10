'use client';

import { useEffect } from 'react';

/** Pantalla amable cuando una sección falla; deja reintentar sin perder la sesión. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="onix-panel mx-auto mt-10 max-w-md px-6 py-10 text-center">
      <p className="font-display text-[18px] font-semibold text-ink">Esta sección no cargó</p>
      <p className="mt-2 text-[13px] text-ink-muted">Puede ser algo momentáneo después de una actualización. Inténtalo de nuevo en unos segundos.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={reset} className="onix-btn-primary">
          Reintentar
        </button>
        <a href="/" className="onix-btn-ghost">
          Ir al inicio
        </a>
      </div>
      {error.digest ? <p className="mt-4 text-[11px] text-ink-subtle">Código: {error.digest}</p> : null}
    </div>
  );
}
