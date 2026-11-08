import { NextResponse } from 'next/server';
import { getBootstrapError, tryEnsureDemoReady } from '@/lib/ensure-demo';
import { isUsingPostgres } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbReady = await tryEnsureDemoReady();
  return NextResponse.json(
    {
      ok: dbReady,
      service: 'onix-govern-web',
      database: isUsingPostgres() ? 'postgres' : 'pglite',
      // Solo el mensaje, sin cadena de conexión ni stack.
      error: dbReady ? null : getBootstrapError(),
    },
    { status: dbReady ? 200 : 503 },
  );
}
