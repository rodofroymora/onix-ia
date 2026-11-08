import { and, eq, inArray } from 'drizzle-orm';
import { actions, aiUseCases, assessments, evidences, invitations } from '@onix/db';
import { getDb, withOrg } from '@/lib/db';
import type { PaletteItem } from '@/components/shell/CommandPalette';
import type { PendingItem } from '@/components/shell/PendingTray';

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-inicio', label: 'Inicio', group: 'Ir a', href: '/' },
  { id: 'nav-eval', label: 'Evaluación: seguimiento', group: 'Ir a', href: '/evaluacion' },
  { id: 'nav-res', label: 'Resultados y brechas', group: 'Ir a', href: '/evaluacion?tab=resultados' },
  { id: 'nav-tec', label: 'Perfil tecnológico', group: 'Ir a', href: '/evaluacion?tab=perfil' },
  { id: 'nav-cmp', label: 'Comparativo de reevaluación', group: 'Ir a', href: '/evaluacion?tab=comparativo' },
  { id: 'nav-inv', label: 'Inventario de casos de IA', group: 'Ir a', href: '/inventario' },
  { id: 'nav-pri', label: 'Priorización', group: 'Ir a', href: '/priorizacion' },
  { id: 'nav-plan', label: 'Plan por etapas', group: 'Ir a', href: '/plan' },
  { id: 'nav-back', label: 'Backlog de acciones', group: 'Ir a', href: '/plan?tab=backlog' },
  { id: 'nav-rep', label: 'Reportes', group: 'Ir a', href: '/reportes' },
  { id: 'nav-org', label: 'Organización y responsables', group: 'Ir a', href: '/organizacion' },
];

/** Índice del buscador y bandeja de pendientes, con consultas ligeras. */
export async function loadShellData(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const cases = await tx
      .select({ id: aiUseCases.id, name: aiUseCases.name, risk: aiUseCases.risk, status: aiUseCases.status })
      .from(aiUseCases)
      .where(eq(aiUseCases.organizationId, organizationId));
    const acts = await tx
      .select({ id: actions.id, title: actions.title, progress: actions.progress, dueDate: actions.dueDate, critical: actions.critical })
      .from(actions)
      .where(eq(actions.organizationId, organizationId));
    const pendingEvidence = acts.length
      ? await tx
          .select({ id: evidences.id, label: evidences.label, actionId: evidences.actionId })
          .from(evidences)
          .where(and(eq(evidences.organizationId, organizationId), eq(evidences.status, 'pending'), inArray(evidences.actionId, acts.map((a) => a.id))))
      : [];
    const openAssess = await tx
      .select({ id: assessments.id })
      .from(assessments)
      .where(and(eq(assessments.organizationId, organizationId), eq(assessments.status, 'in_progress')));
    const pendingInv = openAssess.length
      ? await tx
          .select({ id: invitations.id, email: invitations.email, name: invitations.respondentName })
          .from(invitations)
          .where(and(eq(invitations.organizationId, organizationId), eq(invitations.status, 'pending'), inArray(invitations.assessmentId, openAssess.map((a) => a.id))))
      : [];

    const palette: PaletteItem[] = [
      ...NAV_ITEMS,
      ...cases.map((c) => ({ id: `case-${c.id}`, label: c.name, group: 'Casos de IA' as const, href: `/inventario?caso=${c.id}`, hint: `Riesgo ${c.risk}` })),
      ...acts.map((a) => ({ id: `act-${a.id}`, label: a.title, group: 'Acciones del plan' as const, href: `/plan?tab=backlog&accion=${a.id}`, hint: `${a.progress}%` })),
    ];

    const today = new Date().toISOString().slice(0, 10);
    const pending: PendingItem[] = [
      ...pendingEvidence.map((e) => ({ id: `ev-${e.id}`, label: 'Evidencia por revisar', detail: e.label, href: `/plan?tab=backlog&accion=${e.actionId}` })),
      ...acts
        .filter((a) => a.dueDate && a.dueDate < today && a.progress !== '100')
        .map((a) => ({ id: `due-${a.id}`, label: 'Acción vencida', detail: a.title, href: `/plan?tab=backlog&accion=${a.id}` })),
      ...cases
        .filter((c) => c.status === 'Propuesto' && (c.risk === 'Alto' || c.risk === 'Inaceptable'))
        .map((c) => ({ id: `tri-${c.id}`, label: 'Caso por validar', detail: `${c.name} · riesgo ${c.risk}`, href: `/inventario?tab=validaciones` })),
      ...pendingInv.map((i) => ({ id: `inv-${i.id}`, label: 'Respondente sin contestar', detail: i.name ?? i.email, href: '/evaluacion' })),
    ];

    const completed = await tx
      .select({ id: assessments.id })
      .from(assessments)
      .where(and(eq(assessments.organizationId, organizationId), eq(assessments.status, 'completed')))
      .limit(1);
    const done: string[] = [];
    if (completed.length) done.push('/evaluacion');
    if (cases.length) done.push('/inventario');
    if (cases.some((c) => c.status === 'Aprobado')) done.push('/priorizacion');
    if (acts.length && acts.every((a) => a.progress === '100')) done.push('/plan');

    return { palette, pending, done };
  });
}
