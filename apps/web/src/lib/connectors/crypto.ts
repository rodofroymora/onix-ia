import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Cifrado de credenciales de conectores (tokens de actualización, etc.).
 * La llave vive solo en la variable CONNECTOR_ENC_KEY; sin ella no se guardan credenciales.
 */
function key(): Buffer | null {
  const raw = process.env.CONNECTOR_ENC_KEY?.trim();
  if (!raw || raw.length < 32) return null;
  return createHash('sha256').update(raw).digest();
}

export function encryptionReady(): boolean {
  return key() !== null;
}

export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) throw new Error('Falta CONNECTOR_ENC_KEY (mínimo 32 caracteres).');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function decryptSecret(enc: string): string {
  const k = key();
  if (!k) throw new Error('Falta CONNECTOR_ENC_KEY (mínimo 32 caracteres).');
  const [v, iv, tag, body] = enc.split('.');
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('Credencial con formato desconocido');
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

/** Estado firmado para el ida y vuelta de OAuth (evita CSRF y amarra la conexión a la organización). */
export interface OAuthState {
  orgId: string;
  userId: string;
  nonce: string;
  exp: number;
}

function stateKey(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error('Falta AUTH_SECRET');
  return s;
}

export function signState(st: OAuthState): string {
  const body = Buffer.from(JSON.stringify(st)).toString('base64url');
  const sig = createHmac('sha256', stateKey()).update(`conector:${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(raw: string): OAuthState | null {
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', stateKey()).update(`conector:${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const st = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthState;
    if (!st.exp || Date.now() > st.exp || !st.orgId || !st.userId || !st.nonce) return null;
    return st;
  } catch {
    return null;
  }
}
