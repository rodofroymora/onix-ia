import type { ExtendedRisk } from '@onix/engine';

const TONE: Record<string, string> = {
  Bajo: 'var(--onix-chart-neutral)',
  Medio: 'var(--onix-warning)',
  Alto: 'var(--onix-danger)',
  Inaceptable: 'var(--onix-text)',
};

/** Punto pequeño más texto: el riesgo se lee, no grita. */
export function RiskDot({ risk, compact = false }: { risk: ExtendedRisk | string; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-ink-muted">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: TONE[risk] ?? 'var(--onix-text-subtle)', outline: risk === 'Inaceptable' ? '1px solid var(--onix-text)' : undefined, outlineOffset: 1 }}
        aria-hidden
      />
      {compact ? null : risk}
    </span>
  );
}
