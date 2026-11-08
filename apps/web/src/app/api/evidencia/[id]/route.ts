import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { evidenceFiles } from '@onix/db';
import { auth } from '@/lib/auth';
import { getDb, withOrg } from '@/lib/db';

/** Descarga un archivo de evidencia; solo dentro de la organización de la sesión (RLS). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const { db } = getDb();
  const [f] = await withOrg(db, orgId, (tx) =>
    tx.select().from(evidenceFiles).where(and(eq(evidenceFiles.id, id), eq(evidenceFiles.organizationId, orgId))).limit(1),
  );
  if (!f) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const inline = f.contentType === 'application/pdf' || f.contentType.startsWith('image/');
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      'Content-Type': f.contentType,
      'Content-Length': String(f.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
