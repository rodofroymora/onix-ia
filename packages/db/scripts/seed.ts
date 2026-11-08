import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { compute, findGaps } from '@onix/engine';
import {
  CASE_QUESTIONS_V1,
  MATURITY_QUESTIONS_V1,
  maturityForRoute,
} from '@onix/templates';
import * as schema from '../src/schema/index.js';
import { dataDir, repoRoot } from './paths.js';

async function ensureDemoUsers(
  db: ReturnType<typeof drizzle<typeof schema>>,
  orgId: string,
) {
  const demoUsers = [
    {
      email: 'consultant@onix-ia.com',
      name: 'Consultor Ónix',
      membershipRole: 'owner' as const,
    },
    {
      email: 'admin@altamar.demo',
      name: 'Admin Altamar',
      membershipRole: 'admin' as const,
    },
    {
      email: 'lector@altamar.demo',
      name: 'Lector Altamar',
      membershipRole: 'viewer' as const,
    },
    {
      email: 'gobierno@grupoaltamar.demo',
      name: 'Ana Ruiz',
      membershipRole: 'owner' as const,
    },
  ];

  for (const u of demoUsers) {
    const found = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, u.email))
      .limit(1);
    let userId = found[0]?.id;
    if (!userId) {
      const [row] = await db
        .insert(schema.users)
        .values({ email: u.email, name: u.name, locale: 'es-MX' })
        .returning();
      userId = row!.id;
    }
    const mem = await db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, userId))
      .limit(1);
    if (mem.length === 0) {
      await db.insert(schema.memberships).values({
        organizationId: orgId,
        userId,
        role: u.membershipRole,
      });
    }
  }
}

async function main() {
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });

  const existing = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'grupo-altamar'))
    .limit(1);

  if (existing.length > 0) {
    await ensureDemoUsers(db, existing[0]!.id);
    // Renombra si quedó el nombre corto de seeds previos
    if (existing[0]!.name !== 'Grupo Altamar (demo)') {
      await db
        .update(schema.organizations)
        .set({ name: 'Grupo Altamar (demo)', updatedAt: new Date() })
        .where(eq(schema.organizations.id, existing[0]!.id));
    }
    await writeDemoAuthSnapshot(db, existing[0]!.id, existing[0]!.name === 'Grupo Altamar (demo)' ? existing[0]!.name : 'Grupo Altamar (demo)');
    console.log('Seed ya aplicado (Grupo Altamar (demo)); usuarios demo verificados.');
    await client.close();
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
      respondentTokenHint: respondentToken.slice(0, 8),
    },
  });

  await writeDemoAuthSnapshot(db, org!.id, org!.name);
  await client.close();
  console.log(`Seed OK: Grupo Altamar (demo) → ${path.relative(repoRoot, dataDir)}`);
  console.log(`Invitación respondente (token): ${respondentToken}`);
}

async function writeDemoAuthSnapshot(
  db: ReturnType<typeof drizzle<typeof schema>>,
  orgId: string,
  orgName: string,
) {
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users);

  const snapshot = {
    organizationId: orgId,
    organizationName: orgName,
    users: rows.map((u) => ({ id: u.id, email: u.email, name: u.name })),
  };
  const out = path.resolve(repoRoot, '.data/demo-auth.json');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
