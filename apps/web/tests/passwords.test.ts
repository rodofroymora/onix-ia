import { describe, expect, it } from 'vitest';
import { hashPassword, newToken, orgFromToken, orgPrefix, passwordProblem, tokenHash, verifyPassword } from '@/lib/auth/passwords';

describe('contraseñas', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const h = await hashPassword('Altamar2027x');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Altamar2027x', h)).toBe(true);
    expect(await verifyPassword('otra-cosa-123', h)).toBe(false);
    expect(await verifyPassword('Altamar2027x', null)).toBe(false);
  });

  it('cada hash usa sal distinta', async () => {
    expect(await hashPassword('Misma1234567')).not.toBe(await hashPassword('Misma1234567'));
  });

  it('pide largo mínimo y combinar letras y números', () => {
    expect(passwordProblem('corta1')).toMatch(/10/);
    expect(passwordProblem('soloLetrasLargas')).toMatch(/números/);
    expect(passwordProblem('Buena1234567')).toBeNull();
  });
});

describe('tokens', () => {
  it('lleva la organización en el prefijo y guarda solo el hash', () => {
    const org = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';
    const { token, hash } = newToken(orgPrefix(org));
    expect(orgFromToken(token)).toBe(org);
    expect(hash).toBe(tokenHash(token));
    expect(hash).not.toContain(token);
  });

  it('un token sin prefijo no da organización', () => {
    expect(orgFromToken(newToken().token)).toBeNull();
  });
});
