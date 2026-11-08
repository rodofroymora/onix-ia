import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { aiUsageMetrics, organizations } from '@onix/db';
import { getDb, withOrg } from '@/lib/db';
import { isRateLimited, recordFailure } from '@/lib/rate-limit';

/**
 * Ingesta de telemetría de uso de IA.
 * POST /api/telemetria  Authorization: Bearer onx_<org>_<secreto>
 * Cuerpo: { "month": "2026-11", "tool": "Azure OpenAI", "activeUsers": 120, "requests": 5400, "costMxn": 8200, "incidents": 0, "sanctioned": true }
 * o una lista de esos objetos (máximo 200). Reemplaza el valor del mes para esa herramienta.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const m = /^onx_([0-9a-f]{32})_[A-Za-z0-9_-]{20,}$/.exec(key);
  if (!m) return NextResponse.json({ error: 'Clave inválida' }, { status: 401 });
  const hex = m[1]!;
  const orgId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  // Frena intentos de adivinar la clave (fallos por organización).
  if (await isRateLimited(`telemetry:${orgId}`)) return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });

  const { db } = getDb();
  const [org] = await db.select({ hash: organizations.ingestKeyHash }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const given = createHash('sha256').update(key).digest();
  const expected = org?.hash ? Buffer.from(org.hash, 'hex') : null;
  if (!expected || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await recordFailure(`telemetry:${orgId}`);
    return NextResponse.json({ error: 'Clave inválida' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const items = (Array.isArray(body) ? body : [body]).slice(0, 200) as Record<string, unknown>[];
  const n = (v: unknown, max: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : 0;
  };
  const rows = items
    .filter((i) => typeof i?.month === 'string' && /^\d{4}-\d{2}$/.test(i.month) && typeof i.tool === 'string' && i.tool.trim())
    .map((i) => ({
      organizationId: orgId,
      period: `${i.month as string}-01`,
      tool: String(i.tool).trim().slice(0, 120),
      activeUsers: n(i.activeUsers, 1_000_000),
      requests: n(i.requests, 1_000_000_000),
      costMxn: n(i.costMxn, 1_000_000_000),
      incidents: n(i.incidents, 10_000),
      sanctioned: i.sanctioned !== false,
      source: 'api',
    }));
  if (!rows.length) return NextResponse.json({ error: 'Sin registros válidos (month AAAA-MM y tool son obligatorios)' }, { status: 400 });

  await withOrg(db, orgId, async (tx) => {
    for (const r of rows) {
      await tx
        .insert(aiUsageMetrics)
        .values(r)
        .onConflictDoUpdate({
          target: [aiUsageMetrics.organizationId, aiUsageMetrics.period, aiUsageMetrics.tool],
          set: { activeUsers: r.activeUsers, requests: r.requests, costMxn: r.costMxn, incidents: r.incidents, sanctioned: r.sanctioned, source: 'api' },
        });
    }
  });
  return NextResponse.json({ ok: true, saved: rows.length });
}
