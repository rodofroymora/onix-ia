import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordForm } from '@/components/auth/PasswordForm';
import { resetPasswordAction } from '@/lib/actions/users';

export default async function NuevaContrasenaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell title="Crea una contraseña nueva">
      <PasswordForm action={resetPasswordAction} token={decodeURIComponent(token)} submitLabel="Guardar contraseña" />
    </AuthShell>
  );
}
