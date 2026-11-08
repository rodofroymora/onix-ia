import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/demo-users';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.callbackUrl || '/');

  async function loginAction(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const callbackUrl = String(formData.get('callbackUrl') ?? '/');
    try {
      await signIn('credentials', { email, password, redirectTo: callbackUrl });
    } catch (err) {
      // next-auth throws NEXT_REDIRECT on success
      throw err;
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="onix-panel p-8">
        <p className="font-display text-3xl tracking-tight text-ink">Ónix</p>
        <p className="mt-1 text-sm text-ink-muted">Govern — acceso de demostración</p>
        <form action={loginAction} className="mt-8 space-y-4">
          <input type="hidden" name="callbackUrl" value={params.callbackUrl || '/'} />
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Correo</span>
            <input className="onix-input" name="email" type="email" required defaultValue={DEMO_USERS[0]!.email} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Contraseña</span>
            <input
              className="onix-input"
              name="password"
              type="password"
              required
              defaultValue={DEMO_PASSWORD}
            />
          </label>
          {params.error ? (
            <p className="text-sm text-danger">No pudimos iniciar sesión. Revisa correo y contraseña.</p>
          ) : null}
          <button type="submit" className="onix-btn-primary w-full">
            Entrar
          </button>
        </form>
        <div className="mt-6 border-t border-border pt-4 text-xs text-ink-subtle">
          <p className="mb-2 font-medium text-ink-muted">Usuarios demo</p>
          <ul className="space-y-1">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                {u.email} → {u.role}
              </li>
            ))}
          </ul>
          <p className="mt-2">Contraseña: {DEMO_PASSWORD}</p>
        </div>
      </div>
    </div>
  );
}
