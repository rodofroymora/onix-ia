import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { DEMO_USERS } from '@/lib/demo-users';
import { safeCallbackPath } from '@/lib/safe-redirect';
import { organizationExists } from '@/lib/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; expirada?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  if (session?.user?.organizationId && (await organizationExists(session.user.organizationId))) {
    redirect(callbackUrl);
  }

  async function loginAction(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const target = safeCallbackPath(formData.get('callbackUrl'));
    try {
      await signIn('credentials', { email, password, redirectTo: target });
    } catch (err) {
      // En éxito Auth.js lanza NEXT_REDIRECT, que debe propagarse.
      if (err instanceof AuthError) {
        redirect(`/login?error=1&callbackUrl=${encodeURIComponent(target)}`);
      }
      throw err;
    }
  }

  const ROLE: Record<string, string> = { consultant: 'Consultor', client_admin: 'Administrador del cliente', client_reader: 'Solo lectura' };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-[20px] font-semibold text-canvas">Ó</span>
          <h1 className="mt-5 text-[24px] font-semibold tracking-tight text-ink">Ónix Govern</h1>
          <p className="mt-1 text-[14px] text-ink-muted">Gobierno de IA, paso a paso.</p>
        </div>
        <form action={loginAction} className="onix-panel mt-8 space-y-4 px-6 py-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          {params.expirada ? <p className="text-[13px] text-ink-muted">Tu sesión expiró. Vuelve a entrar.</p> : null}
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-ink-muted">Correo</span>
            <input className="onix-input" name="email" type="email" required autoComplete="username" defaultValue={DEMO_USERS[1]?.email} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-ink-muted">Contraseña</span>
            <input className="onix-input" name="password" type="password" required autoComplete="current-password" />
          </label>
          {params.error ? <p className="text-[13px] text-danger">No pudimos iniciar sesión. Revisa correo y contraseña.</p> : null}
          <button type="submit" className="onix-btn-primary w-full">
            Entrar
          </button>
        </form>
        <div className="mt-6 px-1 text-[12px] text-ink-subtle">
          <p className="mb-2 text-ink-muted">Cuentas de demostración</p>
          <ul className="space-y-1">
            {DEMO_USERS.map((u) => (
              <li key={u.email} className="flex justify-between gap-3">
                <span>{u.email}</span>
                <span>{ROLE[u.role] ?? u.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 text-center text-[11px] leading-relaxed text-ink-subtle">
          Revisión orientativa con base en buenas prácticas de marcos como ISO/IEC 42001, ISO/IEC 27001 y OWASP. ÓNIX no es organismo certificador.
        </p>
      </div>
    </div>
  );
}
