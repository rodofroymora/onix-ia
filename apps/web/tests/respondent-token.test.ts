import { beforeAll, describe, expect, it } from 'vitest';
import {
  createRespondentExpiry,
  signRespondentToken,
  verifyRespondentToken,
} from '../src/lib/respondent-token';

beforeAll(() => {
  process.env.RESPONDENT_TOKEN_SECRET ??= 'test-respondent-token-secret';
});

describe('respondent token HMAC', () => {
  it('firma y verifica un token válido', () => {
    const payload = {
      invitationId: 'inv-1',
      assessmentId: 'as-1',
      organizationId: 'org-1',
      email: 'persona@altamar.demo',
      exp: createRespondentExpiry(1),
    };
    const token = signRespondentToken(payload);
    const verified = verifyRespondentToken(token);
    expect(verified).toEqual(payload);
  });

  it('rechaza firma alterada', () => {
    const token = signRespondentToken({
      invitationId: 'inv-1',
      assessmentId: 'as-1',
      organizationId: 'org-1',
      email: 'persona@altamar.demo',
      exp: createRespondentExpiry(1),
    });
    const [body] = token.split('.');
    expect(verifyRespondentToken(`${body}.AAAA`)).toBeNull();
  });

  it('rechaza token expirado', () => {
    const token = signRespondentToken({
      invitationId: 'inv-1',
      assessmentId: 'as-1',
      organizationId: 'org-1',
      email: 'persona@altamar.demo',
      exp: Date.now() - 1000,
    });
    expect(verifyRespondentToken(token)).toBeNull();
  });
});
