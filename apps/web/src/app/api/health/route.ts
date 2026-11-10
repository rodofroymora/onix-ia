import { NextResponse } from 'next/server';
import { getBootstrapError, tryEnsureDemoReady } from '@/lib/ensure-demo';
import { getDb, isUsingPostgres } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbReady = await tryEnsureDemoReady();
  let lastMigration: string | null = null;
  try {
    const r = await getDb().db.execute(sql`SELECT name FROM govern_migrations ORDER BY applied_at DESC, name DESC LIMIT 1`);
    const rows = (r as unknown as { rows?: { name: string }[] }).rows ?? (r as unknown as { name: string }[]);
    lastMigration = rows[0]?.name ?? null;
  } catch {
    lastMigration = null;
  }
  return NextResponse.json(
    {
      ok: dbReady,
      service: 'onix-govern-web',
      database: isUsingPostgres() ? 'postgres' : 'pglite',
      lastMigration,
      // Solo el mensaje, sin cadena de conexión ni stack.
      error: dbReady ? null : getBootstrapError(),
    },
    { status: dbReady ? 200 : 503 },
  );
}
