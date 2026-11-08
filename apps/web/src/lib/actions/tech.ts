'use server';

import { eq } from 'drizzle-orm';
import { organizations, techProfiles } from '@onix/db';
import { DIMS } from '@onix/engine';
import { TECH_ECOSYSTEMS, TECH_RINGS, type TechItem } from '@onix/templates';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

/** Guarda el perfil tecnológico desde el selector por casillas. */
export async function saveTechProfileAction(formData: FormData) {
  const session = await requireWriteAccess();
  const items: TechItem[] = [];
  for (const eco of TECH_ECOSYSTEMS) {
    for (const tool of eco.tools) {
      const ring = String(formData.get(`ring:${eco.k}:${tool}`) ?? '');
      if (!(TECH_RINGS as readonly string[]).includes(ring)) continue;
      const lic = String(formData.get(`lic:${eco.k}:${tool}`) ?? 'empresarial');
      const license = (['empresarial', 'personal', 'gratuita'].includes(lic) ? lic : 'empresarial') as TechItem['license'];
      // Cuentas personales o gratuitas se marcan para retirar (IA en la sombra).
      items.push({ tool, eco: eco.k, ring: license === 'empresarial' ? (ring as TechItem['ring']) : 'Retirar', license });
    }
  }
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const [existing] = await tx.select().from(techProfiles).where(eq(techProfiles.organizationId, session.user.organizationId)).limit(1);
    if (existing) {
      await tx.update(techProfiles).set({ stack: items, updatedAt: new Date() }).where(eq(techProfiles.id, existing.id));
    } else {
      await tx.insert(techProfiles).values({ organizationId: session.user.organizationId, name: 'Perfil tecnológico', stack: items });
    }
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'tech_profile.update',
      entityType: 'tech_profile',
      meta: { tools: items.length },
    });
  });
  revalidatePath('/evaluacion');
}

/** Metas de madurez por dimensión (las fija el cliente con el consultor). */
export async function saveTargetsAction(formData: FormData) {
  const session = await requireWriteAccess();
  const targets: Record<string, number> = {};
  for (const d of DIMS) {
    const v = Number(formData.get(`target:${d.k}`));
    if (Number.isFinite(v) && v >= 0 && v <= 100) targets[d.k] = Math.round(v);
  }
  const { db } = getDb();
  await db
    .update(organizations)
    .set({ maturityTargets: targets, updatedAt: new Date() })
    .where(eq(organizations.id, session.user.organizationId));
  await withOrg(db, session.user.organizationId, (tx) =>
    appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'targets.update',
      entityType: 'organization',
      entityId: session.user.organizationId,
      meta: targets,
    }),
  );
  revalidatePath('/');
  revalidatePath('/plan');
}
