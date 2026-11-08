import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import { CASE_QUESTIONS_V1, MATURITY_QUESTIONS_V1 } from '@onix/templates';
import type { GovernDb, GovernTx } from './client.js';
import * as schema from './schema/index.js';
import { DEMO_SEED_VERSION, seedDemoV2 } from './demo-seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** sql/ vive junto al paquete (packages/db/sql o vendor/db/sql). */
export function defaultSqlDir(): string {
  const candidates = [
    path.resolve(here, '../sql'),
    path.resolve(here, '../../sql'),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, '0001_init.sql'))) return c;
  }
  return candidates[0]!;
}

/** Orden de migraciones. Las tres primeras son la línea base de las bases ya existentes. */
export const MIGRATION_FILES = [
  '0001_init.sql',
  '0002_inventory_origin_status.sql',
  'rls.sql',
  '0003_v1_completo.sql',
  '0004_catalogos_telemetria_agentes.sql',
] as const;
const BASELINE = ['0001_init.sql', '0002_inventory_origin_status.sql', 'rls.sql'];

function readMigration(sqlDirectory: string, f: string): string {
  const full = path.join(sqlDirectory, f);
  if (!existsSync(full)) throw new Error(`No existe ${full}`);
  return readFileSync(full, 'utf8');
}

export async function applySqlFiles(
  run: (sqlText: string) => Promise<void>,
  sqlDirectory = defaultSqlDir(),
) {
  for (const f of MIGRATION_FILES) {
    await run(readMigration(sqlDirectory, f));
  }
}

/**
 * Aplica solo las migraciones pendientes y las registra en govern_migrations.
 * Si la base ya tenía el esquema (antes del registro), marca la línea base como aplicada.
 */
async function applyPending(
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
  exec: (text: string) => Promise<void>,
  sqlDirectory: string,
) {
  await exec(
    'CREATE TABLE IF NOT EXISTS govern_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set(
    (await query('SELECT name FROM govern_migrations')).rows.map((r) => String(r.name)),
  );
  if (applied.size === 0) {
    const existing = await query("SELECT to_regclass('public.organizations') AS t");
    if (existing.rows[0]?.t) {
      for (const f of BASELINE) {
        await query('INSERT INTO govern_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
        applied.add(f);
      }
    }
  }
  for (const f of MIGRATION_FILES) {
    if (applied.has(f)) continue;
    await exec(readMigration(sqlDirectory, f));
    await query('INSERT INTO govern_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
  }
}

/** @deprecated Prefer applyMigrationsFor(govern). */
export async function applyMigrations(client: PGlite, sqlDirectory = defaultSqlDir()) {
  await applySqlFiles(async (sqlText) => {
    await client.exec(sqlText);
  }, sqlDirectory);
}

export async function applyMigrationsFor(govern: GovernDb, sqlDirectory = defaultSqlDir()) {
  if (govern.kind === 'postgres') {
    // Varias instancias serverless pueden arrancar a la vez: migrar en UNA transacción
    // con advisory lock, para que solo una aplique cada migración pendiente.
    const pool = govern.client as Pool;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(7342000)');
      await applyPending(
        async (text, params) => client.query(text, params as unknown[] | undefined),
        async (text) => {
          await client.query(text);
        },
        sqlDirectory,
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    return;
  }
  const pglite = govern.client as PGlite;
  await applyPending(
    async (text, params) => {
      const r = await pglite.query(text, params as unknown[] | undefined);
      return { rows: r.rows as Record<string, unknown>[] };
    },
    async (text) => {
      await pglite.exec(text);
    },
    sqlDirectory,
  );
}

type Tx = GovernTx;

const DEMO_SLUG = 'grupo-altamar';
const DEMO_NAME = 'Grupo Altamar (demo)';
/** Llave del advisory lock: evita que dos instancias siembren al mismo tiempo. */
const SEED_LOCK_KEY = 7342001;

async function ensureDemoUsers(tx: Tx, orgId: string) {
  const demoUsers = [
    { email: 'consultant@onix-ia.com', name: 'Consultor Ónix', membershipRole: 'owner' as const },
    { email: 'admin@altamar.demo', name: 'Admin Altamar', membershipRole: 'admin' as const },
    { email: 'lector@altamar.demo', name: 'Lector Altamar', membershipRole: 'viewer' as const },
    { email: 'gobierno@grupoaltamar.demo', name: 'Ana Ruiz', membershipRole: 'owner' as const },
  ];

  for (const u of demoUsers) {
    const found = await tx.select().from(schema.users).where(eq(schema.users.email, u.email)).limit(1);
    let userId = found[0]?.id;
    if (!userId) {
      const [row] = await tx
        .insert(schema.users)
        .values({ email: u.email, name: u.name, locale: 'es-MX' })
        .returning();
      userId = row!.id;
    }
    // memberships tiene RLS: esta consulta corre con govern_set_org(orgId) ya fijado.
    const mem = await tx
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.organizationId, orgId)))
      .limit(1);
    if (mem.length === 0) {
      await tx.insert(schema.memberships).values({
        organizationId: orgId,
        userId,
        role: u.membershipRole,
      });
    }
  }
}

/**
 * Migra (si hace falta) y siembra Grupo Altamar en UNA transacción con el tenant fijado,
 * para que funcione bajo FORCE ROW LEVEL SECURITY con un rol que no es superusuario.
 * Es idempotente: si una corrida anterior quedó a medias, completa lo que falta.
 */
export async function ensureDemoSeed(
  govern: GovernDb,
  opts: { sqlDirectory?: string; snapshotPath?: string } = {},
) {
  await applyMigrationsFor(govern, opts.sqlDirectory ?? defaultSqlDir());

  await govern.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

    const existing = await tx
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, DEMO_SLUG))
      .limit(1);

    let org = existing[0];

    // Si la demo existente es de una versión anterior, se borra (en cascada) y se vuelve a sembrar.
    const [meta] = await tx
      .select()
      .from(schema.governMeta)
      .where(eq(schema.governMeta.key, 'demo_seed_version'))
      .limit(1);
    if (org && meta?.value !== DEMO_SEED_VERSION) {
      await tx.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
      org = undefined;
    }

    if (!org) {
      const [created] = await tx
        .insert(schema.organizations)
        .values({ name: DEMO_NAME, slug: DEMO_SLUG, sector: 'hospitalidad', country: 'MX' })
        .returning();
      org = created!;
    } else if (org.name !== DEMO_NAME) {
      await tx
        .update(schema.organizations)
        .set({ name: DEMO_NAME, updatedAt: new Date() })
        .where(eq(schema.organizations.id, org.id));
    }

    await tx.execute(sql`SELECT govern_set_org(${org.id}::uuid)`);
    await ensureDemoUsers(tx as Tx, org.id);

    const seeded = await tx
      .select({ id: schema.assessments.id })
      .from(schema.assessments)
      .where(eq(schema.assessments.organizationId, org.id))
      .limit(1);
    if (seeded.length === 0) {
      await seedDemoContent(tx as Tx, { id: org.id, name: DEMO_NAME });
    }
    await tx
      .insert(schema.governMeta)
      .values({ key: 'demo_seed_version', value: DEMO_SEED_VERSION })
      .onConflictDoUpdate({ target: schema.governMeta.key, set: { value: DEMO_SEED_VERSION, updatedAt: new Date() } });
  });
}

async function seedDemoContent(tx: Tx, org: { id: string; name: string }) {
  const ownerRows = await tx
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'gobierno@grupoaltamar.demo'))
    .limit(1);
  const consultantRows = await tx
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'consultant@onix-ia.com'))
    .limit(1);
  const owner = ownerRows[0]!;
  const consultant = consultantRows[0]!;

  // El cuestionario de sistema se comparte entre organizaciones: reutilízalo si ya existe.
  const existingQv = await tx
    .select()
    .from(schema.questionnaireVersions)
    .where(eq(schema.questionnaireVersions.version, 'v1'))
    .limit(1);
  if (existingQv[0]) {
    await seedDemoV2(tx, org, owner, consultant, existingQv[0]);
    return;
  }

  const [qv] = await tx
    .insert(schema.questionnaireVersions)
    .values({
      version: 'v1',
      label: 'Cuestionario Govern v1 (38)',
      maturityCount: 38,
      isSystem: true,
    })
    .returning();

  let orderIndex = 0;
  for (const q of MATURITY_QUESTIONS_V1) {
    await tx.insert(schema.questions).values({
      questionnaireVersionId: qv!.id,
      code: q.code,
      dimension: q.dimension,
      kind: 'maturity',
      prompt: q.prompt,
      options: q.options,
      orderIndex: orderIndex++,
    });
  }
  for (const q of CASE_QUESTIONS_V1) {
    await tx.insert(schema.questions).values({
      questionnaireVersionId: qv!.id,
      code: q.code,
      kind: 'case',
      prompt: q.prompt,
      options: q.options ?? null,
      orderIndex: orderIndex++,
    });
  }

  await seedDemoV2(tx, org, owner, consultant, qv!);
}
