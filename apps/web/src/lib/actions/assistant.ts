'use server';

import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { loadOrgOverview } from '@/lib/server/insights';
import { PROMPTS, writeWithAssistant, type AssistantTask } from '@/lib/server/narrative';
import { requireSession } from '@/lib/session';

export type { AssistantTask } from '@/lib/server/narrative';

export interface AssistantState {
  text: string;
  source: 'llm' | 'datos';
  sources: string[];
  task: AssistantTask;
}

export async function askAssistantAction(_prev: AssistantState | null, formData: FormData): Promise<AssistantState> {
  const session = await requireSession();
  const task = (String(formData.get('task') ?? 'resumen_ejecutivo') as AssistantTask) in PROMPTS
    ? (String(formData.get('task')) as AssistantTask)
    : 'resumen_ejecutivo';
  const o = await loadOrgOverview(session.user.organizationId);
  const { text, source, sources } = await writeWithAssistant(task, o, session.user.organizationName ?? '');

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, (tx) =>
    appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'assistant.suggest',
      entityType: 'assistant',
      meta: { task, source },
    }),
  );

  return { text, source, sources, task };
}
