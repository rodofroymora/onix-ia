'use server';

import { eq } from 'drizzle-orm';
import {
  memberships,
  organizations,
  prioritizationWeights,
  responsibilityMaps,
} from '@onix/db';
import { SECTOR_TEMPLATES } from '@onix/templates';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireConsultant, requireWriteAccess } from '@/lib/session';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

/** CU-01: crear organización con plantilla sectorial y mapa de responsabilidades. */
export async function createOrganizationAction(formData: FormData) {
  const session = await requireConsultant();
  const name = String(formData.get('name') ?? '').trim();
  const sector = String(formData.get('sector') ?? 'hospitalidad');
  if (!name) throw new Error('Nombre requerido');

  const template = SECTOR_TEMPLATES.find((t) => t.id === sector) ?? SECTOR_TEMPLATES[0]!;
  const { db } = getDb();

  const [org] = await db
    .insert(organizations)
    .values({
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      sector: template.id,
      country: 'MX',
    })
    .returning();

  await db.insert(memberships).values({
    organizationId: org!.id,
    userId: session.user.id,
    role: 'owner',
  });

  await withOrg(db, org!.id, async (tx) => {
    await tx.insert(responsibilityMaps).values({
      organizationId: org!.id,
      title: `Mapa de responsabilidades IA — ${name}`,
      roles: [
        { role: 'Sponsor ejecutivo', person: 'Pendiente' },
        { role: 'Dueño de datos', person: 'Pendiente' },
        { role: 'Responsable de riesgos', person: 'Pendiente' },
        ...template.focusDimensions.map((d) => ({
          role: `Enfoque ${d}`,
          person: 'Pendiente',
        })),
      ],
    });

    await tx.insert(prioritizationWeights).values({
      organizationId: org!.id,
      name: 'default',
      impactoNegocio: '0.2500',
      urgenciaRegulatoria: '0.2000',
      facilidadImplementacion: '0.1500',
      dependenciaOtros: '0.1000',
      riesgoResidual: '0.2000',
      valorAprendizaje: '0.1000',
    });

    await appendAudit(tx, {
      organizationId: org!.id,
      actorUserId: session.user.id,
      action: 'organization.create',
      entityType: 'organization',
      entityId: org!.id,
      meta: { sector: template.id },
    });
  });

  revalidatePath('/organizaciones');
}

export async function updateResponsibilityMapAction(formData: FormData) {
  const session = await requireWriteAccess();
  const mapId = String(formData.get('mapId') ?? '');
  const rolesRaw = String(formData.get('roles') ?? '[]');
  const roles = JSON.parse(rolesRaw) as { role: string; person: string }[];

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx
      .update(responsibilityMaps)
      .set({ roles, updatedAt: new Date() })
      .where(eq(responsibilityMaps.id, mapId));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'responsibility_map.update',
      entityType: 'responsibility_map',
      entityId: mapId,
    });
  });
  revalidatePath('/organizacion');
}
