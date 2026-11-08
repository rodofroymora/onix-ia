'use server';

import { and, eq } from 'drizzle-orm';
import { aiAgents, aiUseCases } from '@onix/db';
import { AGENT_CHANNELS, AGENT_PLATFORMS, AGENT_PUBLISHERS, AGENT_STATUSES, inCatalog } from '@onix/templates';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { requireWriteAccess } from '@/lib/session';

const RISKS = ['Bajo', 'Medio', 'Alto', 'Inaceptable'];
const pick = (list: string[], v: FormDataEntryValue | null, def: string) => (list.includes(String(v)) ? String(v) : def);
const listOf = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((x) => x.slice(0, 80));

/** Registra o actualiza un agente en el inventario de Agent Discovery. */
export async function saveAgentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 160);
  if (!name) throw new Error('Nombre requerido');
  const platform = inCatalog(AGENT_PLATFORMS, formData.get('platform')) ?? 'custom';
  const useCaseId = String(formData.get('useCaseId') ?? '');
  const values = {
    name,
    description: String(formData.get('description') ?? '').trim().slice(0, 1000) || null,
    platform,
    publisher: pick(AGENT_PUBLISHERS, formData.get('publisher'), 'Organización'),
    channel: pick(AGENT_CHANNELS, formData.get('channel'), 'Interno'),
    ownerName: String(formData.get('ownerName') ?? '').trim().slice(0, 120) || null,
    status: pick(AGENT_STATUSES, formData.get('status'), 'En producción'),
    risk: pick(RISKS, formData.get('risk'), 'Medio'),
    managed: formData.get('managed') === 'on',
    useCaseId: /^[0-9a-f-]{36}$/.test(useCaseId) ? useCaseId : null,
    dataSources: listOf(formData.get('dataSources')),
    capabilities: listOf(formData.get('capabilities')),
    monthlyUsers: Math.max(0, Math.min(10_000_000, Math.round(Number(formData.get('monthlyUsers')) || 0))),
  };
  const { db } = getDb();
  let savedId = id;
  await withOrg(db, orgId, async (tx) => {
    if (id) {
      await tx.update(aiAgents).set({ ...values, updatedAt: new Date() }).where(and(eq(aiAgents.id, id), eq(aiAgents.organizationId, orgId)));
    } else {
      const [row] = await tx.insert(aiAgents).values({ ...values, organizationId: orgId, origin: 'manual' }).returning();
      savedId = row!.id;
    }
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: id ? 'agent.update' : 'agent.create',
      entityType: 'ai_agent',
      entityId: savedId,
      meta: { platform, risk: values.risk, managed: values.managed },
    });
  });
  revalidatePath('/agentes');
  revalidatePath('/');
  redirect(`/agentes?agente=${savedId}`);
}

/** Crea el caso del inventario a partir de un agente descubierto y los deja ligados. */
export async function createCaseFromAgentAction(formData: FormData) {
  const session = await requireWriteAccess();
  const orgId = session.user.organizationId;
  const agentId = String(formData.get('agentId') ?? '');
  const { db } = getDb();
  const caseId = await withOrg(db, orgId, async (tx) => {
    const [a] = await tx.select().from(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizationId, orgId))).limit(1);
    if (!a) throw new Error('Agente no encontrado');
    if (a.useCaseId) return a.useCaseId;
    const platform = AGENT_PLATFORMS.find((p) => p.k === a.platform);
    const risk = RISKS.includes(a.risk) ? (a.risk as 'Bajo' | 'Medio' | 'Alto' | 'Inaceptable') : 'Medio';
    const caps = (Array.isArray(a.capabilities) ? a.capabilities : []) as string[];
    const [row] = await tx
      .insert(aiUseCases)
      .values({
        organizationId: orgId,
        name: a.name,
        description: a.description ?? (caps.length ? `Agente que puede: ${caps.join(', ')}.` : ''),
        risk,
        origin: 'discovery',
        status: 'Propuesto',
        inProduction: a.status === 'En producción' && risk !== 'Inaceptable',
        ownerName: a.ownerName,
        technology: platform?.n ?? a.platform,
        vendor: platform?.d ?? null,
        customerFacing: ['WhatsApp', 'Web'].includes(a.channel),
        autonomy: caps.length > 1 ? 'aprueba_humano' : 'sugiere',
        aiType: 'agente',
      })
      .returning();
    await tx.update(aiAgents).set({ useCaseId: row!.id, updatedAt: new Date() }).where(and(eq(aiAgents.id, a.id), eq(aiAgents.organizationId, orgId)));
    await appendAudit(tx, {
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'use_case.from_agent',
      entityType: 'ai_use_case',
      entityId: row!.id,
      meta: { agentId: a.id },
    });
    return row!.id;
  });
  revalidatePath('/agentes');
  revalidatePath('/inventario');
  redirect(`/inventario?caso=${caseId}`);
}
