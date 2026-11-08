export type AppRole = 'consultant' | 'client_admin' | 'client_reader';

export interface DemoUser {
  email: string;
  name: string;
  role: AppRole;
}

/** Contraseña demo solo desde entorno; nunca hardcodeada en el código. */
export function getDemoPassword(): string | undefined {
  const value = process.env.DEMO_PASSWORD?.trim();
  return value || undefined;
}

export const DEMO_USERS: DemoUser[] = [
  {
    email: 'consultant@onix-ia.com',
    name: 'Consultor Ónix',
    role: 'consultant',
  },
  {
    email: 'admin@altamar.demo',
    name: 'Admin Altamar',
    role: 'client_admin',
  },
  {
    email: 'lector@altamar.demo',
    name: 'Lector Altamar',
    role: 'client_reader',
  },
];

export function findDemoUser(email: string, password: string): DemoUser | null {
  const expected = getDemoPassword();
  if (!expected) return null;
  const normalized = email.trim().toLowerCase();
  const user = DEMO_USERS.find((u) => u.email === normalized);
  if (!user || password !== expected) return null;
  return user;
}

export function canWrite(role: AppRole): boolean {
  return role === 'consultant' || role === 'client_admin';
}

export function isConsultant(role: AppRole): boolean {
  return role === 'consultant';
}
