'use server';

import { AI_TYPES, DATA_CLASSES, DEPLOYMENTS, USER_SCOPES, VALUE_TYPES, inCatalog, type CatalogOption } from '@onix/templates';

import { and, eq } from 'drizzle-orm';
import { aiUseCases, assessments, triageValidations } from '@onix/db';
import { triage } from '@onix/engine';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

function scale(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function text(v: FormDataEntryValue | null, max = 500): string | null {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

const AUTONOMY = ['sugiere', 'aprueba_humano', 'autonomo'];

/** Ficha completa del caso (CU-05): crea si no hay id, si no actualiza. */
export async function saveUseCaseAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Nombre requerido');
  const origin = parseOrigin(formData.get('origin'));
  const status = enforceOriginStatus(origin, String(formData.get('status') ?? 'Propuesto'));
  const risk = parseRisk(formData.get('risk'));
  // Un caso inaceptable nunca puede quedar aprobado ni en producción.
  const finalStatus = risk === 'Inaceptable' && status === 'Aprobado' ? 'En revisión' : status;
  const autonomyRaw = String(formData.get('autonomy') ?? 'sugiere');
  const annual = Number(String(formData.get('annualValue') ?? '').replace(/[^0-9]/g, ''));
  const values = {
    name: name.slice(0, 160),
    description: text(formData.get('description'), 1000) ?? '',
    area: text(formData.get('area'), 120) ?? '',
    risk,
    origin,
    status: finalStatus,
    inProduction: formData.get('inProduction') === 'on' && risk !== 'Inaceptable',
    ownerName: text(formData.get('ownerName'), 120),
    technology: text(formData.get('technology'), 160),
    vendor: text(formData.get('vendor'), 120),
    usesPersonalData: formData.get('usesPersonalData') === 'on',
    decidesOnPeople: formData.get('decidesOnPeople') === 'on',
    customerFacing: formData.get('customerFacing') === 'on',
    autonomy: AUTONOMY.includes(autonomyRaw) ? autonomyRaw : 'sugiere',
    valueScore: scale(formData.get('valueScore')),
    annualValue: Number.isFinite(annual) && annual > 0 ? Math.min(annual, 2_000_000_000) : null,
    strategicObjective: text(formData.get('strategicObjective'), 200),
    strategicFit: scale(formData.get('strategicFit')),
    dataQuality: scale(formData.get('dataQuality')),
    effort: scale(formData.get('effort')),
    techMaturity: scale(formData.get('techMaturity')),
    integration: scale(formData.get('integration')),
    infrastructure: scale(formData.get('infrastructure')),
    skills: scale(formData.get('skills')),
    aiType: inCatalog(AI_TYPES, formData.get('aiType')),
    valueType: inCatalog(VALUE_TYPES, formData.get('valueType')),
    dataClassification: inCatalog(DATA_CLASSES, formData.get('dataClassification')),
    deployment: inCatalog(DEPLOYMENTS, formData.get('deployment')),
    userScope: inCatalog(USER_SCOPES, formData.get('userScope')),
  };

  const { db } = getDb();
  let savedId = id;
  await withOrg(db, session.user.organizationId, async (tx) => {
    if (id) {
      await tx
        .update(aiUseCases)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(aiUseCases.id, id), eq(aiUseCases.organizationId, session.user.organizationId)));
    } else {
      const [row] = await tx
        .insert(aiUseCases)
        .values({ ...values, organizationId: session.user.organizationId })
        .returning();
      savedId = row!.id;
    }
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: id ? 'use_case.update' : 'use_case.create',
      entityType: 'ai_use_case',
      entityId: savedId,
      meta: { risk, status: finalStatus, origin },
    });
  });
  revalidatePath('/inventario');
  revalidatePath('/priorizacion');
  revalidatePath('/');
  redirect(`/inventario?caso=${savedId}`);
}

/** CU-07: validación humana del nivel de riesgo. Si no coinciden, gana el nivel más alto. */
export async function validateCaseAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const proposed = parseRisk(formData.get('risk'));
  const note = text(formData.get('note'), 400);
  const { db } = getDb();
  await withOrg(db, session.user.organizationId, async (tx) => {
    const [c] = await tx
      .select()
      .from(aiUseCases)
      .where(and(eq(aiUseCases.id, id), eq(aiUseCases.organizationId, session.user.organizationId)))
      .limit(1);
    if (!c) throw new Error('Caso no encontrado');
    const order = ['Bajo', 'Medio', 'Alto', 'Inaceptable'];
    const finalRisk = order[Math.max(order.indexOf(c.risk), order.indexOf(proposed))] as typeof c.risk;
    const status =
      decision === 'rechazar' || finalRisk === 'Inaceptable'
        ? 'Descartado'
        : decision === 'condicionar'
          ? 'En revisión'
          : 'Aprobado';
    await tx
      .update(aiUseCases)
      .set({ risk: finalRisk, status, inProduction: status === 'Aprobado' ? c.inProduction : false, updatedAt: new Date() })
      .where(eq(aiUseCases.id, c.id));
    const [assessment] = await tx
      .select({ id: assessments.id })
      .from(assessments)
      .where(eq(assessments.organizationId, session.user.organizationId))
      .limit(1);
    if (assessment) {
      await tx.insert(triageValidations).values({
        organizationId: session.user.organizationId,
        assessmentId: assessment.id,
        subject: c.name,
        opinions: [order.indexOf(c.risk) + 1, order.indexOf(proposed) + 1],
        agreed: c.risk === proposed,
        resolvedValue: order.indexOf(finalRisk) + 1,
      });
    }
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'use_case.validate',
      entityType: 'ai_use_case',
      entityId: c.id,
      meta: { decision, proposed, finalRisk, status, note },
    });
  });
  revalidatePath('/inventario');
  revalidatePath('/');
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

export interface ImportRow {
  name: string;
  description?: string;
  risk?: string;
  area?: string;
  status?: string;
  ownerName?: string;
  technology?: string;
  vendor?: string;
  usesPersonalData?: boolean;
  decidesOnPeople?: boolean;
  customerFacing?: boolean;
  valueScore?: number | null;
  strategicObjective?: string;
  effort?: number | null;
  aiType?: string;
  valueType?: string;
}

/** CU-05: importación desde Excel. Todo entra como Propuesto y origen import; duplicados por nombre se omiten. */
const byName = (list: CatalogOption[], v: unknown): string | null => {
  const t = String(v ?? '').trim().toLowerCase();
  if (!t) return null;
  return list.find((o) => o.k === t || o.n.toLowerCase() === t)?.k ?? null;
};

export async function importUseCasesFromRows(rows: ImportRow[]): Promise<{ created: number; skipped: number }> {
  const session = await requireWriteAccess();
  const { db } = getDb();
  const clampScale = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  let created = 0;
  let skipped = 0;
  await withOrg(db, session.user.organizationId, async (tx) => {
    const existing = await tx
      .select({ name: aiUseCases.name })
      .from(aiUseCases)
      .where(eq(aiUseCases.organizationId, session.user.organizationId));
    const seen = new Set(existing.map((e) => e.name.trim().toLowerCase()));
    for (const row of rows.slice(0, 500)) {
      const name = String(row.name ?? '').trim().slice(0, 160);
      if (!name || seen.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      seen.add(name.toLowerCase());
      await tx.insert(aiUseCases).values({
        organizationId: session.user.organizationId,
        name,
        description: String(row.description ?? '').slice(0, 1000),
        risk: parseRisk(row.risk),
        area: String(row.area ?? '').slice(0, 120),
        origin: 'import',
        status: 'Propuesto',
        ownerName: row.ownerName ? String(row.ownerName).slice(0, 120) : null,
        technology: row.technology ? String(row.technology).slice(0, 160) : null,
        vendor: row.vendor ? String(row.vendor).slice(0, 120) : null,
        usesPersonalData: Boolean(row.usesPersonalData),
        decidesOnPeople: Boolean(row.decidesOnPeople),
        customerFacing: Boolean(row.customerFacing),
        valueScore: clampScale(row.valueScore),
        strategicObjective: row.strategicObjective ? String(row.strategicObjective).slice(0, 200) : null,
        effort: clampScale(row.effort),
        aiType: byName(AI_TYPES, row.aiType),
        valueType: byName(VALUE_TYPES, row.valueType),
      });
      created++;
    }
    await appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'use_case.import',
      entityType: 'ai_use_case',
      meta: { created, skipped },
    });
  });
  revalidatePath('/inventario');
  return { created, skipped };
}
