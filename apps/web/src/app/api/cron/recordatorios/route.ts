import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { assessments, invitations, memberships, organizations, users } from '@onix/db';
import { getDb, withOrg } from '@/lib/db';
import { appBaseUrl, respondentPath, sendEmail } from '@/lib/notify';
import { syncAllConnectors } from '@/lib/connectors/sync';

export const maxDuration = 300;

const EVERY_DAYS = 3;
const MAX_REMINDERS = 3;

/**
 * Tarea diaria (Vercel Cron): recuerda a quien no ha contestado su cuestionario y avisa
 * a los administradores cuando falta un mes o menos para la reevaluación. También revisa los conectores.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no está configurado' }, { status: 503 });
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { db } = getDb();
  const base = await appBaseUrl();
  const orgs = await db.select().from(organizations);
  let respondents = 0;
  let reevals = 0;
  const now = Date.now();

  for (const org of orgs) {
    await withOrg(db, org.id, async (tx) => {
      // 1) Respondentes pendientes en evaluaciones abiertas.
      const open = await tx.select({ id: assessments.id }).from(assessments).where(and(eq(assessments.organizationId, org.id), eq(assessments.status, 'in_progress')));
      if (open.length) {
        const pend = await tx
          .select()
          .from(invitations)
          .where(and(eq(invitations.organizationId, org.id), eq(invitations.status, 'pending'), inArray(invitations.assessmentId, open.map((a) => a.id))));
        for (const inv of pend) {
          const last = (inv.lastRemindedAt ?? inv.createdAt).getTime();
          const expired = inv.expiresAt && inv.expiresAt.getTime() < now;
          if (expired || inv.remindersSent >= MAX_REMINDERS || now - last < EVERY_DAYS * 86_400_000) continue;
          if (inv.email.endsWith('.demo')) continue;
          try {
            const r = await sendEmail({
              to: inv.email,
              subject: `Recordatorio: cuestionario de IA de ${org.name}`,
              paragraphs: [
                inv.respondentName ? `Hola, ${inv.respondentName.split(' ')[0]}:` : 'Hola:',
                `Aún falta tu parte en la revisión de gobierno de IA de ${org.name}. Son unos 15 minutos y puedes seguir donde te quedaste.`,
              ],
              cta: { label: 'Contestar ahora', href: `${base}${respondentPath(inv.token)}` },
            });
            if (r === 'sent') {
              respondents++;
              await tx.update(invitations).set({ lastRemindedAt: new Date(), remindersSent: inv.remindersSent + 1 }).where(eq(invitations.id, inv.id));
            }
          } catch (err) {
            console.error('[cron] recordatorio a respondente falló', err);
          }
        }
      }

      // 2) Reevaluación a 30 días o menos.
      const [last] = await tx
        .select()
        .from(assessments)
        .where(and(eq(assessments.organizationId, org.id), eq(assessments.status, 'completed')))
        .orderBy(desc(assessments.createdAt))
        .limit(1);
      if (!last || open.length) return;
      const due = new Date(last.publishedAt ?? last.updatedAt);
      due.setMonth(due.getMonth() + (org.reevaluationMonths ?? 6));
      const dueKey = due.toISOString().slice(0, 10);
      const days = Math.ceil((due.getTime() - now) / 86_400_000);
      if (days > 30 || org.reevalRemindedFor === dueKey) return;
      const admins = await tx
        .select({ email: users.email, name: users.name })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.organizationId, org.id), inArray(memberships.role, ['owner', 'admin'])));
      let sent = 0;
      for (const a of admins.filter((x) => !x.email.endsWith('.demo'))) {
        try {
          const r = await sendEmail({
            to: a.email,
            subject: `Toca la reevaluación de IA de ${org.name}`,
            paragraphs: [
              `Hola, ${a.name.split(' ')[0]}:`,
              days >= 0
                ? `En ${days} días se cumplen ${org.reevaluationMonths} meses de la última evaluación. Lanzar la reevaluación permite medir el avance del plan.`
                : `La reevaluación venció hace ${-days} días. Lánzala para medir el avance del plan.`,
            ],
            cta: { label: 'Ir a Evaluación', href: `${base}/evaluacion` },
          });
          if (r === 'sent') sent++;
        } catch (err) {
          console.error('[cron] aviso de reevaluación falló', err);
        }
      }
      if (sent) {
        reevals++;
        await tx.update(organizations).set({ reevalRemindedFor: dueKey }).where(eq(organizations.id, org.id));
      }
    });
  }
  // 3) Conectores de descubrimiento (Microsoft, AWS): revisión diaria.
  let connectorsRun = { runs: 0, errors: 0 };
  try {
    connectorsRun = await syncAllConnectors(orgs.map((o) => o.id));
  } catch (err) {
    console.error('[cron] conectores fallaron', err);
  }

  return NextResponse.json({ ok: true, respondents, reevaluations: reevals, connectors: connectorsRun });
}
