import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '../src/schema/index.js';
import { dataDir, repoRoot } from './paths.js';

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
    console.log('Seed ya aplicado (Grupo Altamar).');
    await client.close();
    return;
  }

  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: 'Grupo Altamar',
      slug: 'grupo-altamar',
      sector: 'hospitalidad',
      country: 'MX',
    })
    .returning();

  const [owner] = await db
    .insert(schema.users)
    .values({
      email: 'gobierno@grupoaltamar.demo',
      name: 'Ana Ruiz',
      locale: 'es-MX',
    })
    .returning();

  await db.insert(schema.memberships).values({
    organizationId: org!.id,
    userId: owner!.id,
    role: 'owner',
  });

  const [qv] = await db
    .insert(schema.questionnaireVersions)
    .values({
      version: 'v1',
      label: 'Cuestionario Govern v1 (38)',
      maturityCount: 38,
      isSystem: true,
    })
    .returning();

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

  const [assessment] = await db
    .insert(schema.assessments)
    .values({
      organizationId: org!.id,
      questionnaireVersionId: qv!.id,
      title: 'Revisión inicial — Grupo Altamar',
      status: 'draft',
      saasRoute: 38,
      createdBy: owner!.id,
    })
    .returning();

  await db.insert(schema.aiUseCases).values({
    organizationId: org!.id,
    assessmentId: assessment!.id,
    name: 'Asistente de reservaciones por WhatsApp',
    description: 'Caso demo; riesgo medio orientativo.',
    risk: 'Medio',
    recommended: true,
    inProduction: false,
    area: 'Atención a clientes',
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
  for (let i = 0; i < stageNames.length; i++) {
    await db.insert(schema.stages).values({
      organizationId: org!.id,
      planId: plan!.id,
      name: stageNames[i]!,
      orderIndex: i,
    });
  }

  await db.insert(schema.auditLogs).values({
    organizationId: org!.id,
    actorUserId: owner!.id,
    action: 'seed',
    entityType: 'organization',
    entityId: org!.id,
    meta: { demo: true, note: 'Grupo Altamar — datos de demostración' },
  });

  await client.close();
  console.log(`Seed OK: Grupo Altamar → ${path.relative(repoRoot, dataDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
