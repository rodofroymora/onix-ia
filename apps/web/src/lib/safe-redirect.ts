/** Solo permite rutas internas relativas ("/plan", "/evaluacion?x=1"). Evita open redirect. */
export function safeCallbackPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\r\n]/.test(value) || value.includes('://')) return fallback;
  return value;
}
