import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const N = 16384;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, n = N): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEYLEN, { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Guarda la contraseña como scrypt$N$sal$hash (sin dependencias externas). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), Number(n));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Reglas mínimas: 10 caracteres, con letras y números. Devuelve el problema o null. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return 'Usa al menos 10 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password) || !/\d/.test(password)) return 'Combina letras y números.';
  if (password.length > 200) return 'Es demasiado larga.';
  return null;
}

/** Token de un solo uso: el valor va en el enlace; en la base solo su sha256. */
export function newToken(prefix = ''): { token: string; hash: string } {
  const raw = `${prefix}${randomBytes(32).toString('base64url')}`;
  return { token: raw, hash: tokenHash(raw) };
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Para enlaces de invitación: el id de la organización viaja en el token para fijar RLS antes de buscar. */
export function orgFromToken(token: string): string | null {
  const m = /^([0-9a-f]{32})_/.exec(token);
  if (!m) return null;
  const h = m[1]!;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const orgPrefix = (orgId: string) => `${orgId.replace(/-/g, '')}_`;
