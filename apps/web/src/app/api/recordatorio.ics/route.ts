import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { loadOrgOverview } from '@/lib/server/insights';

/** Evento de calendario (.ics) para la próxima reevaluación. */
export async function GET() {
  const session = await auth();
  const orgId = session?.user?.organizationId;
  if (!orgId) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });
  const o = await loadOrgOverview(orgId);
  const nr = o.nextReevaluation;
  if (!nr) return NextResponse.json({ error: 'Aún no hay evaluación publicada' }, { status: 404 });
  const day = nr.date.replace(/-/g, '');
  const next = new Date(`${nr.date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const org = (o.org?.name ?? '').replace(/[\\,;\n]/g, ' ');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ONIX//Govern//ES',
    'BEGIN:VEVENT',
    `UID:reevaluacion-${orgId}-${day}@onix-ia.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:Reevaluación de gobierno de IA · ${org}`,
    `DESCRIPTION:Toca lanzar la reevaluación en Ónix Govern (cada ${nr.months} meses).`,
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reevaluación de IA en una semana',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reevaluacion-ia.ics"',
    },
  });
}
