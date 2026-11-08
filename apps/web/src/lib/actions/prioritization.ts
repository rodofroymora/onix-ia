'use server';

import { and, eq } from 'drizzle-orm';
import { prioritizationWeights } from '@onix/db';
import { normalizeWeights } from '@onix/engine';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

export async function updateWeightsAction(formData: FormData) {
  const session = await requireWriteAccess();
  const raw = {
    impactoNegocio: Number(formData.get('impactoNegocio')),
    urgenciaRegulatoria: Number(formData.get('urgenciaRegulatoria')),
    facilidadImplementacion: Number(formData.get('facilidadImplementacion')),
    dependenciaOtros: Number(formData.get('dependenciaOtros')),
    riesgoResidual: Number(formData.get('riesgoResidual')),
    valorAprendizaje: Number(formData.get('valorAprendizaje')),
  };
  const weights = normalizeWeights(raw);
  if (!weights) throw new Error('Pesos inválidos');

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const existing = await tx
      .select()
      .from(prioritizationWeights)
      .where(eq(prioritizationWeights.organizationId, session.user.organizationId))
      .limit(1);

    const values = {
      impactoNegocio: weights.impactoNegocio.toFixed(4),
      urgenciaRegulatoria: weights.urgenciaRegulatoria.toFixed(4),
      facilidadImplementacion: weights.facilidadImplementacion.toFixed(4),
      dependenciaOtros: weights.dependenciaOtros.toFixed(4),
      riesgoResidual: weights.riesgoResidual.toFixed(4),
      valorAprendizaje: weights.valorAprendizaje.toFixed(4),
      updatedAt: new Date(),
    };

    if (existing[0]) {
      await tx
        .update(prioritizationWeights)
        .set(values)
        .where(
          and(
            eq(prioritizationWeights.id, existing[0].id),
            eq(prioritizationWeights.organizationId, session.user.organizationId),
          ),
        );
    } else {
      await tx.insert(prioritizationWeights).values({
        organizationId: session.user.organizationId,
        name: 'default',
        ...values,
      });
    }

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'prioritization.weights_update',
      entityType: 'prioritization_weights',
      meta: { ...weights },
    });
  });

  revalidatePath('/priorizacion');
}
