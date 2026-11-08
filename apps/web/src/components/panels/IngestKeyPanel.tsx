'use client';

import { useState, useTransition } from 'react';
import { generateIngestKeyAction } from '@/lib/actions/telemetry';
import { CopyButton } from '@/components/ui/CopyButton';

export function IngestKeyPanel({ hasKey, canWrite }: { hasKey: boolean; canWrite: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 text-[13px]">
      <p className="text-ink-muted">
        Tus sistemas (Azure, AWS, Google, n8n o un script) pueden mandar el uso mensual a esta dirección. Cada envío reemplaza el mes de esa herramienta.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-canvas-subtle px-3 py-2.5 text-[11px] leading-relaxed text-ink">
{`POST /api/telemetria
Authorization: Bearer <tu clave>
{ "month": "2026-11", "tool": "Azure OpenAI",
  "activeUsers": 120, "requests": 5400,
  "costMxn": 8200, "incidents": 0, "sanctioned": true }`}
      </pre>
      {key ? (
        <div className="rounded-lg border border-border px-3 py-2.5">
          <p className="text-[12px] text-ink-muted">Guárdala ahora; no se vuelve a mostrar.</p>
          <p className="mt-1 break-all font-mono text-[11px] text-ink">{key}</p>
          <div className="mt-2">
            <CopyButton text={key} label="Copiar clave" />
          </div>
        </div>
      ) : null}
      {canWrite ? (
        <button
          type="button"
          className="onix-btn-ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await generateIngestKeyAction();
              setKey(r.key);
            })
          }
        >
          {hasKey ? 'Generar clave nueva (invalida la anterior)' : 'Generar clave de telemetría'}
        </button>
      ) : null}
    </div>
  );
}
