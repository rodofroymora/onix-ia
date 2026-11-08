'use server';

import { and, eq } from 'drizzle-orm';
import {
  memberships,
  organizations,
  prioritizationWeights,
  responsibilityMaps,
} from '@onix/db';
import { FUNCTIONS, SECTOR_TEMPLATES } from '@onix/templates';
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
      title: `Mapa de responsabilidades IA · ${name}`,
      roles: FUNCTIONS.map((f) => ({ fn: f.k, role: f.n, person: '', email: '' })),
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

/** CU-01: mapa de responsabilidades por función (una persona por función). */
export async function updateResponsibilityMapAction(formData: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const roles = FUNCTIONS.map((f) => ({
    fn: f.k,
    role: f.n,
    person: String(formData.get(`person:${f.k}`) ?? '').trim().slice(0, 120),
    email: String(formData.get(`email:${f.k}`) ?? '').trim().slice(0, 160),
  }));

  const { db } = getDb();
  await withOrg(db, orgId, async (tx) => {
    const [existing] = await tx.select().from(responsibilityMaps).where(eq(responsibilityMaps.organizationId, orgId)).limit(1);
    let mapId = existing?.id;
    if (existing) {
      await tx
        .update(responsibilityMaps)
        .set({ roles, updatedAt: new Date() })
        .where(and(eq(responsibilityMaps.id, existing.id), eq(responsibilityMaps.organizationId, orgId)));
    } else {
      const [row] = await tx
        .insert(responsibilityMaps)
        .values({ organizationId: orgId, title: 'Mapa de responsabilidades IA', roles })
        .returning();
      mapId = row!.id;
    }
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'responsibility_map.update',
      entityType: 'responsibility_map',
      entityId: mapId,
    });
  });
  revalidatePath('/organizacion');
  revalidatePath('/');
}
