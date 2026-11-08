import { headers } from 'next/headers';

/** URL pública de la app: APP_URL, o la del request, o la de Vercel. */
export async function appBaseUrl(): Promise<string> {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
      return `${proto}://${host}`;
    }
  } catch {
    // fuera de un request
  }
  const vercel = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : 'http://localhost:3000';
}

export function respondentPath(token: string): string {
  return `/r/${encodeURIComponent(token)}`;
}

/** Mensaje para WhatsApp (wa.me con texto precargado; sin API). */
export function whatsappShareUrl(link: string, name: string | null, orgName: string): string {
  const saludo = name ? `Hola, ${name.split(' ')[0]}.` : 'Hola.';
  const text = `${saludo} Te comparto el cuestionario de la Revisión inicial de IA de ${orgName}. Te toma unos 15 minutos y puedes pausar y seguir después: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Envía la invitación por correo con Resend si RESEND_API_KEY está configurada.
 * Sin proveedor no hace nada: el consultor comparte el enlace o lo manda por WhatsApp.
 */
export async function sendInvitationEmail(input: {
  to: string;
  name: string | null;
  organizationName: string;
  token: string;
}): Promise<'sent' | 'skipped'> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !input.token) return 'skipped';
  const from = process.env.EMAIL_FROM?.trim() || 'ÓNIX <onboarding@resend.dev>';
  const link = `${await appBaseUrl()}${respondentPath(input.token)}`;
  const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const saludo = input.name ? `Hola, ${esc(input.name.split(' ')[0] ?? '')}:` : 'Hola:';
  const org = esc(input.organizationName);
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#1d1d1f;line-height:1.5;max-width:520px">
      <p>${saludo}</p>
      <p>${org} está haciendo su Revisión inicial de IA con ÓNIX y te invitamos a contestar las preguntas de tu área.</p>
      <p>Las preguntas están agrupadas en seis temas; te toma unos 15 minutos, no necesitas crear cuenta y puedes pausar y seguir después.</p>
      <p><a href="${esc(link)}" style="display:inline-block;background:#1d1d1f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Contestar el cuestionario</a></p>
      <p style="color:#6e6e73;font-size:13px">El enlace es personal y vence en 14 días.</p>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Revisión inicial de IA de ${input.organizationName}`,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
  return 'sent';
}
