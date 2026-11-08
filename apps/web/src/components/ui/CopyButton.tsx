'use client';

import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

export function CopyButton({ text, label = 'Copiar enlace' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[12px] text-ink-muted transition hover:text-ink"
      onClick={async () => {
        const full = text.startsWith('/') ? `${window.location.origin}${text}` : text;
        try {
          await navigator.clipboard.writeText(full);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {
          window.prompt('Copia el enlace', full);
        }
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" strokeWidth={1.6} />}
      {ok ? 'Copiado' : label}
    </button>
  );
}

/** WhatsApp con el enlace completo (se arma en el navegador para usar el dominio actual). */
export function WhatsAppButton({ path, name, org }: { path: string; name: string | null; org: string }) {
  return (
    <button
      type="button"
      className="text-[12px] text-ink-muted transition hover:text-ink"
      onClick={() => {
        const link = `${window.location.origin}${path}`;
        const saludo = name ? `Hola, ${name.split(' ')[0]}.` : 'Hola.';
        const text = `${saludo} Te comparto el cuestionario de la Revisión inicial de IA de ${org}. Te toma unos 15 minutos y puedes pausar y seguir después: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }}
    >
      WhatsApp
    </button>
  );
}
