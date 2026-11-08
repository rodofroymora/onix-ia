'use server';

import { and, eq } from 'drizzle-orm';
import { aiUseCases, assessments, triageValidations } from '@onix/db';
import { triage } from '@onix/engine';
import { revalidatePath } from 'next/cache';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

const ALLOWED_STATUS = ['Propuesto', 'En revisión', 'Aprobado', 'Descartado'] as const;
const ALLOWED_RISK = ['Bajo', 'Medio', 'Alto', 'Inaceptable'] as const;
const ALLOWED_ORIGIN = ['manual', 'import', 'discovery'] as const;
type Risk = (typeof ALLOWED_RISK)[number];

function parseRisk(value: unknown): Risk {
  const v = String(value ?? '');
  return (ALLOWED_RISK as readonly string[]).includes(v) ? (v as Risk) : 'Medio';
}

function parseOrigin(value: unknown, fallback = 'manual'): string {
  const v = String(value ?? '');
  return (ALLOWED_ORIGIN as readonly string[]).includes(v) ? v : fallback;
}

/** CU-06: discovery solo puede entrar como Propuesto. */
function enforceOriginStatus(origin: string, status: string): string {
  if (origin === 'discovery') return 'Propuesto';
  if (!(ALLOWED_STATUS as readonly string[]).includes(status)) return 'Propuesto';
  return status;
}

export async function createUseCaseAction(formData: FormData) {
  const session = await requireWriteAccess();
  const name = String(formData.get('name') ?? '').trim();
  const origin = parseOrigin(formData.get('origin'));
  const status = enforceOriginStatus(origin, String(formData.get('status') ?? 'Propuesto'));
  const risk = parseRisk(formData.get('risk'));
  const description = String(formData.get('description') ?? '');
  const area = String(formData.get('area') ?? '');

  if (!name) throw new Error('Nombre requerido');

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const [row] = await tx
      .insert(aiUseCases)
      .values({
        organizationId: session.user.organizationId,
        name,
        description,
        risk,
        area,
        origin,
        status,
      })
      .returning();

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'use_case.create',
      entityType: 'ai_use_case',
      entityId: row!.id,
      meta: { origin, status },
    });
  });

  revalidatePath('/inventario');
}

export async function updateUseCaseAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = String(formData.get('id') ?? '');
  const origin = parseOrigin(formData.get('origin'));
  const status = enforceOriginStatus(origin, String(formData.get('status') ?? 'Propuesto'));

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx
      .update(aiUseCases)
      .set({
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        risk: parseRisk(formData.get('risk')),
        area: String(formData.get('area') ?? ''),
        origin,
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(aiUseCases.id, id), eq(aiUseCases.organizationId, session.user.organizationId)));

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'use_case.update',
      entityType: 'ai_use_case',
      entityId: id,
    });
  });
  revalidatePath('/inventario');
}

export async function deleteUseCaseAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = String(formData.get('id') ?? '');
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    await tx
      .delete(aiUseCases)
      .where(and(eq(aiUseCases.id, id), eq(aiUseCases.organizationId, session.user.organizationId)));
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'use_case.delete',
      entityType: 'ai_use_case',
      entityId: id,
    });
  });
  revalidatePath('/inventario');
}

/** CU-07: triage — si discrepan, se toma el máximo (motor). */
export async function runTriageAction(formData: FormData) {
  const session = await requireWriteAccess();
  const assessmentId = String(formData.get('assessmentId') ?? '');
  const subject = String(formData.get('subject') ?? '');
  const opinions = String(formData.get('opinions') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 4);

  const result = triage({ opinions });
  if (!result) throw new Error('Opiniones inválidas');

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    // La FK no respeta RLS: verificar que la evaluación sea de la organización del usuario.
    const [owned] = await tx
      .select({ id: assessments.id })
      .from(assessments)
      .where(and(eq(assessments.id, assessmentId), eq(assessments.organizationId, session.user.organizationId)))
      .limit(1);
    if (!owned) throw new Error('Evaluación no válida para esta organización');

    const [row] = await tx
      .insert(triageValidations)
      .values({
        organizationId: session.user.organizationId,
        assessmentId,
        subject,
        opinions,
        agreed: result.agreed,
        resolvedValue: result.value,
      })
      .returning();

    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'triage.resolve',
      entityType: 'triage_validation',
      entityId: row!.id,
      meta: { agreed: result.agreed, value: result.value },
    });
  });

  revalidatePath('/inventario');
}

export async function importUseCasesFromRows(
  rows: {
    name: string;
    description?: string;
    risk?: string;
    area?: string;
    origin?: string;
    status?: string;
  }[],
) {
  const session = await requireWriteAccess();
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    for (const row of rows) {
      if (!row.name?.trim()) continue;
      const origin = parseOrigin(row.origin, 'import');
      const status = enforceOriginStatus(origin, row.status ?? 'Propuesto');
      await tx.insert(aiUseCases).values({
        organizationId: session.user.organizationId,
        name: row.name.trim(),
        description: row.description ?? '',
        risk: parseRisk(row.risk),
        area: row.area ?? '',
        origin,
        status,
      });
    }
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'use_case.import',
      entityType: 'ai_use_case',
      meta: { count: rows.length },
    });
  });
  revalidatePath('/inventario');
}
