import { createHmac, timingSafeEqual } from 'node:crypto';

export interface RespondentPayload {
  invitationId: string;
  assessmentId: string;
  organizationId: string;
  email: string;
  exp: number;
}

function secret(): string {
  const value = process.env.RESPONDENT_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!value) {
    throw new Error('Falta RESPONDENT_TOKEN_SECRET o AUTH_SECRET');
  }
  return value;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function signRespondentToken(payload: RespondentPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyRespondentToken(token: string): RespondentPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  let expected: Buffer;
  try {
    expected = createHmac('sha256', secret()).update(body).digest();
  } catch {
    return null;
  }
  const given = fromB64url(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as RespondentPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.invitationId || !payload.assessmentId || !payload.organizationId || !payload.email) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createRespondentExpiry(days = 14): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}
