import type { OrgOverview } from '@/lib/server/insights';

type Usage = OrgOverview['usage'][number];

const MONTH = (p: string) =>
  new Date(`${p}T12:00:00Z`).toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' }).replace('.', '');

/** Resumen de telemetría por mes y por herramienta (últimos 6 meses). */
export function summarizeUsage(usage: Usage[]) {
  const periods = [...new Set(usage.map((u) => String(u.period)))].sort().slice(-6);
  const by = (p: string) => usage.filter((u) => String(u.period) === p);
  const sum = (rows: Usage[], k: 'activeUsers' | 'requests' | 'costMxn' | 'incidents') => rows.reduce((t, r) => t + (r[k] ?? 0), 0);
  const monthly = periods.map((p) => {
    const rows = by(p);
    const ok = rows.filter((r) => r.sanctioned);
    const shadow = rows.filter((r) => !r.sanctioned);
    return {
      period: p,
      label: MONTH(p),
      requests: sum(rows, 'requests'),
      sanctionedRequests: sum(ok, 'requests'),
      shadowRequests: sum(shadow, 'requests'),
      users: sum(rows, 'activeUsers'),
      cost: sum(rows, 'costMxn'),
      incidents: sum(rows, 'incidents'),
    };
  });
  const last = monthly.at(-1) ?? null;
  const prev = monthly.at(-2) ?? null;
  const delta = (a?: number, b?: number) => (a != null && b ? Math.round(((a - b) / b) * 100) : null);
  const lastRows = last ? by(last.period) : [];
  const tools = lastRows
    .map((r) => {
      const before = prev ? by(prev.period).find((x) => x.tool === r.tool) : undefined;
      return { ...r, change: delta(r.requests, before?.requests) };
    })
    .sort((x, y) => y.requests - x.requests);
  const shadowShare = last && last.requests ? Math.round((last.shadowRequests / last.requests) * 100) : 0;
  return {
    periods,
    monthly,
    last,
    prev,
    tools,
    shadowShare,
    change: {
      requests: delta(last?.requests, prev?.requests),
      users: delta(last?.users, prev?.users),
      cost: delta(last?.cost, prev?.cost),
    },
    incidents6m: monthly.reduce((t, m) => t + m.incidents, 0),
  };
}

export const mxn = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
