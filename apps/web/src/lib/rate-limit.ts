import { eq, sql } from 'drizzle-orm';
import { authAttempts } from '@onix/db';
import { getDb } from './db';

/**
 * Límite de intentos por llave (correo o recurso), guardado en Postgres para que funcione
 * con varias instancias. Si la base falla, cae a memoria para no bloquear el acceso.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const memory = new Map<string, { count: number; resetAt: number }>();

export async function isRateLimited(key: string): Promise<boolean> {
  try {
    const { db } = getDb();
    const [row] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);
    if (!row || row.resetAt.getTime() < Date.now()) return false;
    return row.count >= MAX_ATTEMPTS;
  } catch {
    const e = memory.get(key);
    return Boolean(e && e.resetAt > Date.now() && e.count >= MAX_ATTEMPTS);
  }
}

export async function recordFailure(key: string): Promise<void> {
  const resetAt = new Date(Date.now() + WINDOW_MS);
  try {
    const { db } = getDb();
    await db
      .insert(authAttempts)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: authAttempts.key,
        set: {
          count: sql`CASE WHEN ${authAttempts.resetAt} < now() THEN 1 ELSE ${authAttempts.count} + 1 END`,
          resetAt: sql`CASE WHEN ${authAttempts.resetAt} < now() THEN ${resetAt.toISOString()}::timestamptz ELSE ${authAttempts.resetAt} END`,
        },
      });
  } catch {
    const e = memory.get(key);
    if (!e || e.resetAt < Date.now()) memory.set(key, { count: 1, resetAt: resetAt.getTime() });
    else e.count += 1;
  }
}

export async function clearFailures(key: string): Promise<void> {
  memory.delete(key);
  try {
    const { db } = getDb();
    await db.delete(authAttempts).where(eq(authAttempts.key, key));
  } catch {
    /* sin base: ya se limpió la memoria */
  }
}
