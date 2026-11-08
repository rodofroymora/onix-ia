import { createHash, timingSafeEqual } from 'node:crypto';

export type AppRole = 'consultant' | 'client_admin' | 'client_reader';

export interface DemoUser {
  email: string;
  name: string;
  role: AppRole;
}

/** Contraseña demo de las cuentas del cliente: solo desde entorno, nunca en el código. */
export function getDemoPassword(): string | undefined {
  const value = process.env.DEMO_PASSWORD?.trim();
  return value || undefined;
}

/**
 * Contraseña de la cuenta consultor (ve todas las organizaciones).
 * Si CONSULTANT_PASSWORD está definida, se exige esa; si no, usa DEMO_PASSWORD
 * para no romper el acceso actual de la demo.
 */
export function getConsultantPassword(): string | undefined {
  const value = process.env.CONSULTANT_PASSWORD?.trim();
  return value || getDemoPassword();
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

/** Comparación en tiempo constante (hash previo para igualar longitudes). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function findDemoUser(email: string, password: string): DemoUser | null {
  const normalized = email.trim().toLowerCase();
  const user = DEMO_USERS.find((u) => u.email === normalized);
  const expected = user?.role === 'consultant' ? getConsultantPassword() : getDemoPassword();
  if (!expected) return null;
  // Comparar siempre, aunque el usuario no exista, para no filtrar cuáles existen por tiempo.
  const ok = safeEqual(password, expected);
  if (!user || !ok) return null;
  return user;
}

export function canWrite(role: AppRole): boolean {
  return role === 'consultant' || role === 'client_admin';
}

export function isConsultant(role: AppRole): boolean {
  return role === 'consultant';
}
