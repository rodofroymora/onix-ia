'use client';

import { useState } from 'react';
import { updateWeightsAction } from '@/lib/actions/prioritization';

export function WeightsForm({
  criteria,
  initial,
  disabled,
}: {
  criteria: readonly { k: string; n: string; hint: string }[];
  initial: Record<string, number>;
  disabled?: boolean;
}) {
  const [w, setW] = useState<Record<string, number>>(() =>
    Object.fromEntries(criteria.map((c) => [c.k, Math.round((initial[c.k] ?? 1 / 6) * 100)])),
  );
  const total = Object.values(w).reduce((t, v) => t + v, 0) || 1;
  return (
    <form action={updateWeightsAction} className="space-y-4">
      {criteria.map((c) => {
        const pct = Math.round((w[c.k]! / total) * 100);
        return (
          <div key={c.k}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`w-${c.k}`} className="text-[13px] text-ink">
                {c.n}
              </label>
              <span className="text-[12px] tabular-nums text-ink-muted">{pct}%</span>
            </div>
            <input
              id={`w-${c.k}`}
              type="range"
              min={0}
              max={50}
              step={1}
              name={c.k}
              value={w[c.k]}
              disabled={disabled}
              onChange={(e) => setW((prev) => ({ ...prev, [c.k]: Number(e.target.value) }))}
              className="mt-1.5 w-full accent-[var(--onix-accent)]"
            />
            <p className="text-[11px] text-ink-subtle">{c.hint}</p>
          </div>
        );
      })}
      {!disabled ? (
        <button className="onix-btn-primary w-full">Guardar pesos</button>
      ) : (
        <p className="text-[12px] text-ink-subtle">Solo lectura.</p>
      )}
      <p className="text-[11px] text-ink-subtle">El cliente define los pesos según lo que valora; el consultor los ajusta y todo queda en la bitácora.</p>
    </form>
  );
}
