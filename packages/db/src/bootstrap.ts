import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { compute, findGaps } from '@onix/engine';
import {
  CASE_QUESTIONS_V1,
  MATURITY_QUESTIONS_V1,
  maturityForRoute,
} from '@onix/templates';
import type { GovernDb } from './client.js';
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

export async function applyMigrations(client: PGlite, sqlDirectory = defaultSqlDir()) {
  const files = ['0001_init.sql', '0002_inventory_origin_status.sql', 'rls.sql'];
  for (const f of files) {
    const full = path.join(sqlDirectory, f);
    if (!existsSync(full)) throw new Error(`No existe ${full}`);
    await client.exec(readFileSync(full, 'utf8'));
  }
}

async function ensureDemoUsers(db: GovernDb['db'], orgId: string) {
  const demoUsers = [
    { email: 'consultant@onix-ia.com', name: 'Consultor Ónix', membershipRole: 'owner' as const },
    { email: 'admin@altamar.demo', name: 'Admin Altamar', membershipRole: 'admin' as const },
    { email: 'lector@altamar.demo', name: 'Lector Altamar', membershipRole: 'viewer' as const },
    { email: 'gobierno@grupoaltamar.demo', name: 'Ana Ruiz', membershipRole: 'owner' as const },
  ];

  for (const u of demoUsers) {
    const found = await db.select().from(schema.users).where(eq(schema.users.email, u.email)).limit(1);
    let userId = found[0]?.id;
    if (!userId) {
      const [row] = await db
        .insert(schema.users)
        .values({ email: u.email, name: u.name, locale: 'es-MX' })
        .returning();
      userId = row!.id;
    }
    const mem = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, userId)).limit(1);
    if (mem.length === 0) {
      await db.insert(schema.memberships).values({
        organizationId: orgId,
        userId,
        role: u.membershipRole,
      });
    }
  }
}

async function writeDemoAuthSnapshot(
  db: GovernDb['db'],
  orgId: string,
  orgName: string,
  snapshotPath: string,
) {
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users);

  mkdirSync(path.dirname(snapshotPath), { recursive: true });
  writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        organizationId: orgId,
        organizationName: orgName,
        users: rows.map((u) => ({ id: u.id, email: u.email, name: u.name })),
      },
      null,
      2,
    ),
  );
}

/** Si no hay org demo, migra (si hace falta) y siembra Grupo Altamar. */
export async function ensureDemoSeed(
  govern: GovernDb,
  opts: { snapshotPath: string; sqlDirectory?: string },
) {
  const { db, client } = govern;

  let orgs: { id: string; name: string; slug: string }[] = [];
  try {
    orgs = await db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        slug: schema.organizations.slug,
      })
      .from(schema.organizations)
      .limit(1);
  } catch {
    await applyMigrations(client, opts.sqlDirectory ?? defaultSqlDir());
    orgs = [];
  }

  const existing = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'grupo-altamar'))
    .limit(1);

  if (existing.length > 0) {
    await ensureDemoUsers(db, existing[0]!.id);
    const name = 'Grupo Altamar (demo)';
    if (existing[0]!.name !== name) {
      await db
        .update(schema.organizations)
        .set({ name, updatedAt: new Date() })
        .where(eq(schema.organizations.id, existing[0]!.id));
    }
    await writeDemoAuthSnapshot(db, existing[0]!.id, name, opts.snapshotPath);
    return;
  }

  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: 'Grupo Altamar (demo)',
      slug: 'grupo-altamar',
      sector: 'hospitalidad',
      country: 'MX',
    })
    .returning();

  await ensureDemoUsers(db, org!.id);

  const ownerRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'gobierno@grupoaltamar.demo'))
    .limit(1);
  const consultantRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'consultant@onix-ia.com'))
    .limit(1);
  const owner = ownerRows[0]!;
  const consultant = consultantRows[0]!;

  const [qv] = await db
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
    await db.insert(schema.questions).values({
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
    await db.insert(schema.questions).values({
      questionnaireVersionId: qv!.id,
      code: q.code,
      kind: 'case',
      prompt: q.prompt,
      options: q.options ?? null,
      orderIndex: orderIndex++,
    });
  }

  await db.insert(schema.responsibilityMaps).values({
    organizationId: org!.id,
    title: 'Mapa de responsabilidades IA — Grupo Altamar',
    roles: [
      { role: 'Sponsor ejecutivo', person: 'Ana Ruiz' },
      { role: 'Dueño de datos', person: 'Pendiente' },
      { role: 'Responsable de riesgos', person: 'Pendiente' },
    ],
  });

  await db.insert(schema.prioritizationWeights).values({
    organizationId: org!.id,
    name: 'default',
    impactoNegocio: '0.2500',
    urgenciaRegulatoria: '0.2000',
    facilidadImplementacion: '0.1500',
    dependenciaOtros: '0.1000',
    riesgoResidual: '0.2000',
    valorAprendizaje: '0.1000',
  });

  await db.insert(schema.techProfiles).values({
    organizationId: org!.id,
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

  const [assessment] = await db
    .insert(schema.assessments)
    .values({
      organizationId: org!.id,
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
    await db.insert(schema.dimensionResults).values({
      organizationId: org!.id,
      assessmentId: assessment!.id,
      dimension: d.k,
      score: d.s,
      level: d.l,
    });
  }

  for (const g of findGaps(result.dims)) {
    await db.insert(schema.gaps).values({
      organizationId: org!.id,
      assessmentId: assessment!.id,
      fromDimension: g.from,
      toDimension: g.to,
      fromLevel: g.fromLevel,
      toLevel: g.toLevel,
      delta: g.delta,
    });
  }

  const dbQuestions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.questionnaireVersionId, qv!.id));

  for (let i = 0; i < routeQuestions.length; i++) {
    const code = routeQuestions[i]!.code;
    const qRow = dbQuestions.find((q) => q.code === code);
    if (!qRow) continue;
    await db.insert(schema.answers).values({
      organizationId: org!.id,
      assessmentId: assessment!.id,
      questionId: qRow.id,
      userId: owner.id,
      valueInt: maturityAnswers[i]!,
    });
  }

  const respondentToken = randomBytes(24).toString('hex');
  await db.insert(schema.invitations).values({
    organizationId: org!.id,
    assessmentId: assessment!.id,
    email: 'respondente@altamar.demo',
    role: 'member',
    status: 'pending',
    token: respondentToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  });

  await db.insert(schema.aiUseCases).values({
    organizationId: org!.id,
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

  await db.insert(schema.triageValidations).values({
    organizationId: org!.id,
    assessmentId: assessment!.id,
    subject: 'Nivel de autonomía del asistente',
    opinions: [2, 2, 3],
    agreed: false,
    resolvedValue: 3,
  });

  const [plan] = await db
    .insert(schema.plans)
    .values({
      organizationId: org!.id,
      assessmentId: assessment!.id,
      title: 'Plan de gobierno IA — Altamar',
    })
    .returning();

  const stageNames = ['Bases', 'Controles', 'Mejora continua'] as const;
  const stageIds: string[] = [];
  for (let i = 0; i < stageNames.length; i++) {
    const [st] = await db
      .insert(schema.stages)
      .values({
        organizationId: org!.id,
        planId: plan!.id,
        name: stageNames[i]!,
        orderIndex: i,
      })
      .returning();
    stageIds.push(st!.id);
  }

  await db.insert(schema.actions).values({
    organizationId: org!.id,
    planId: plan!.id,
    stageId: stageIds[0]!,
    title: 'Inventario de herramientas y agentes autorizados',
    dimension: 'rol',
    progress: '25',
    critical: true,
    deletable: false,
    ownerUserId: owner.id,
  });

  await db.insert(schema.reports).values({
    organizationId: org!.id,
    assessmentId: assessment!.id,
    title: 'Informe de Revisión inicial — Altamar',
    kind: 'revision_inicial',
    payload: {
      note: 'Borrador demo. No constituye certificación.',
      globalScore: result.gs,
      globalLevel: result.gl,
    },
  });

  await db.insert(schema.auditLogs).values({
    organizationId: org!.id,
    actorUserId: consultant.id,
    action: 'seed',
    entityType: 'organization',
    entityId: org!.id,
    meta: {
      demo: true,
      note: 'Grupo Altamar (demo) — datos de demostración',
    },
  });

  await writeDemoAuthSnapshot(db, org!.id, org!.name, opts.snapshotPath);
}
