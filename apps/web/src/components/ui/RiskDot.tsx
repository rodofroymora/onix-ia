import type { ExtendedRisk } from '@onix/engine';

const TONE: Record<string, string> = {
  Bajo: 'bg-success',
  Medio: 'bg-warning',
  Alto: 'bg-danger',
  Inaceptable: 'bg-danger',
};

export function RiskDot({ risk }: { risk: ExtendedRisk | string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <span className={`h-2 w-2 rounded-full ${TONE[risk] ?? 'bg-ink-subtle'}`} aria-hidden />
      {risk}
    </span>
  );
}
