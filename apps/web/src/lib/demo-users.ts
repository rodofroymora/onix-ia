export type AppRole = 'consultant' | 'client_admin' | 'client_reader';

export interface DemoUser {
  email: string;
  name: string;
  role: AppRole;
  /** Contraseña compartida de demostración. */
  password: string;
}

export const DEMO_PASSWORD = 'Altamar2026!';

export const DEMO_USERS: DemoUser[] = [
  {
    email: 'consultant@onix-ia.com',
    name: 'Consultor Ónix',
    role: 'consultant',
    password: DEMO_PASSWORD,
  },
  {
    email: 'admin@altamar.demo',
    name: 'Admin Altamar',
    role: 'client_admin',
    password: DEMO_PASSWORD,
  },
  {
    email: 'lector@altamar.demo',
    name: 'Lector Altamar',
    role: 'client_reader',
    password: DEMO_PASSWORD,
  },
];

export function findDemoUser(email: string, password: string): DemoUser | null {
  const normalized = email.trim().toLowerCase();
  const user = DEMO_USERS.find((u) => u.email === normalized);
  if (!user || user.password !== password) return null;
  return user;
}

export function canWrite(role: AppRole): boolean {
  return role === 'consultant' || role === 'client_admin';
}

export function isConsultant(role: AppRole): boolean {
  return role === 'consultant';
}
