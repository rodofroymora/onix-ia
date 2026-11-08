import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import { compute, findGaps } from '@onix/engine';
import {
  CASE_QUESTIONS_V1,
  MATURITY_QUESTIONS_V1,
  maturityForRoute,
} from '@onix/templates';
import type { GovernDb, GovernTx } from './client.js';
import * as schema from './schema/index.js';

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

export async function applySqlFiles(
  run: (sqlText: string) => Promise<void>,
  sqlDirectory = defaultSqlDir(),
) {
  const files = ['0001_init.sql', '0002_inventory_origin_status.sql', 'rls.sql'];
  for (const f of files) {
    const full = path.join(sqlDirectory, f);
    if (!existsSync(full)) throw new Error(`No existe ${full}`);
    await run(readFileSync(full, 'utf8'));
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
    const pool = govern.client as Pool;
    await applySqlFiles(async (sqlText) => {
      await pool.query(sqlText);
    }, sqlDirectory);
    return;
  }
  const pglite = govern.client as PGlite;
  await applySqlFiles(async (sqlText) => {
    await pglite.exec(sqlText);
  }, sqlDirectory);
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

async function tablesExist(govern: GovernDb): Promise<boolean> {
  try {
    await govern.db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
    return true;
  } catch {
    return false;
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
  if (!(await tablesExist(govern))) {
    await applyMigrationsFor(govern, opts.sqlDirectory ?? defaultSqlDir());
  }

  await govern.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);

    const existing = await tx
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, DEMO_SLUG))
      .limit(1);

    let org = existing[0];
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
    if (seeded.length > 0) return;

    await seedDemoContent(tx as Tx, { id: org.id, name: DEMO_NAME });
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
    await seedOrgContent(tx, org, owner, consultant, existingQv[0]);
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

  await seedOrgContent(tx, org, owner, consultant, qv!);
}

type UserRow = typeof schema.users.$inferSelect;
type QvRow = typeof schema.questionnaireVersions.$inferSelect;

async function seedOrgContent(
  tx: Tx,
  org: { id: string; name: string },
  owner: UserRow,
  consultant: UserRow,
  qv: QvRow,
) {
  await tx.insert(schema.responsibilityMaps).values({
    organizationId: org.id,
    title: 'Mapa de responsabilidades IA — Grupo Altamar',
    roles: [
      { role: 'Sponsor ejecutivo', person: 'Ana Ruiz' },
      { role: 'Dueño de datos', person: 'Pendiente' },
      { role: 'Responsable de riesgos', person: 'Pendiente' },
    ],
  });

  await tx.insert(schema.prioritizationWeights).values({
    organizationId: org.id,
    name: 'default',
    impactoNegocio: '0.2500',
    urgenciaRegulatoria: '0.2000',
    facilidadImplementacion: '0.1500',
    dependenciaOtros: '0.1000',
    riesgoResidual: '0.2000',
    valorAprendizaje: '0.1000',
  });

  await tx.insert(schema.techProfiles).values({
    organizationId: org.id,
    name: 'Stack hotelero demo',
    stack: ['PMS', 'CRM', 'WhatsApp Business', 'ChatGPT Enterprise'],
    notes: 'Perfil demo para Revisión inicial. No constituye certificación.',
  });

  const routeQuestions = maturityForRoute(38);
  const maturityAnswers = routeQuestions.map((_, i) => ((i % 4) + 1) as number);
  const result = compute({
    m: maturityAnswers,
    proc: 2,
    aut: 2,
    pres: 2,
    datos: 2,
    afect: 3,
    area: 0,
    name: 'Asistente de reservaciones',
    org: 'Grupo Altamar (demo)',
  });
  if (!result) throw new Error('compute falló en seed');

  const [assessment] = await tx
    .insert(schema.assessments)
    .values({
      organizationId: org.id,
      questionnaireVersionId: qv!.id,
      title: 'Revisión inicial — Grupo Altamar',
      status: 'completed',
      saasRoute: 38,
      globalScore: result.gs,
      globalLevel: result.gl,
      routeIndex: result.route,
      createdBy: owner.id,
    })
    .returning();

  for (const d of result.dims) {
    await tx.insert(schema.dimensionResults).values({
      organizationId: org.id,
      assessmentId: assessment!.id,
      dimension: d.k,
      score: d.s,
      level: d.l,
    });
  }

  for (const g of findGaps(result.dims)) {
    await tx.insert(schema.gaps).values({
      organizationId: org.id,
      assessmentId: assessment!.id,
      fromDimension: g.from,
      toDimension: g.to,
      fromLevel: g.fromLevel,
      toLevel: g.toLevel,
      delta: g.delta,
    });
  }

  const dbQuestions = await tx
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.questionnaireVersionId, qv!.id));

  for (let i = 0; i < routeQuestions.length; i++) {
    const code = routeQuestions[i]!.code;
    const qRow = dbQuestions.find((q) => q.code === code);
    if (!qRow) continue;
    await tx.insert(schema.answers).values({
      organizationId: org.id,
      assessmentId: assessment!.id,
      questionId: qRow.id,
      userId: owner.id,
      valueInt: maturityAnswers[i]!,
    });
  }

  const respondentToken = randomBytes(24).toString('hex');
  await tx.insert(schema.invitations).values({
    organizationId: org.id,
    assessmentId: assessment!.id,
    email: 'respondente@altamar.demo',
    role: 'member',
    status: 'pending',
    token: respondentToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  });

  await tx.insert(schema.aiUseCases).values({
    organizationId: org.id,
    assessmentId: assessment!.id,
    name: 'Asistente de reservaciones por WhatsApp',
    description: 'Caso demo; riesgo medio orientativo.',
    risk: 'Medio',
    recommended: true,
    inProduction: false,
    area: 'Atención a clientes',
    origin: 'manual',
    status: 'En revisión',
  });

  await tx.insert(schema.triageValidations).values({
    organizationId: org.id,
    assessmentId: assessment!.id,
    subject: 'Nivel de autonomía del asistente',
    opinions: [2, 2, 3],
    agreed: false,
    resolvedValue: 3,
  });

  const [plan] = await tx
    .insert(schema.plans)
    .values({
      organizationId: org.id,
      assessmentId: assessment!.id,
      title: 'Plan de gobierno IA — Altamar',
    })
    .returning();

  const stageNames = ['Bases', 'Controles', 'Mejora continua'] as const;
  const stageIds: string[] = [];
  for (let i = 0; i < stageNames.length; i++) {
    const [st] = await tx
      .insert(schema.stages)
      .values({
        organizationId: org.id,
        planId: plan!.id,
        name: stageNames[i]!,
        orderIndex: i,
      })
      .returning();
    stageIds.push(st!.id);
  }

  await tx.insert(schema.actions).values({
    organizationId: org.id,
    planId: plan!.id,
    stageId: stageIds[0]!,
    title: 'Inventario de herramientas y agentes autorizados',
    dimension: 'rol',
    progress: '25',
    critical: true,
    deletable: false,
    ownerUserId: owner.id,
  });

  await tx.insert(schema.reports).values({
    organizationId: org.id,
    assessmentId: assessment!.id,
    title: 'Informe de Revisión inicial — Altamar',
    kind: 'revision_inicial',
    payload: {
      note: 'Borrador demo. No constituye certificación.',
      globalScore: result.gs,
      globalLevel: result.gl,
    },
  });

  await tx.insert(schema.auditLogs).values({
    organizationId: org.id,
    actorUserId: consultant.id,
    action: 'seed',
    entityType: 'organization',
    entityId: org.id,
    meta: {
      demo: true,
      note: 'Grupo Altamar (demo) — datos de demostración',
    },
  });
}
