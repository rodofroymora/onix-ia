/**
 * Nombre visible del ambiente cuando no es Producción ("Pruebas"), o null en Producción.
 * Vercel pone VERCEL_TARGET_ENV (production, preview o el nombre del ambiente propio, como staging).
 * ONIX_ENV_LABEL permite forzar el texto.
 */
export function environmentLabel(): string | null {
  const forced = process.env.ONIX_ENV_LABEL?.trim();
  if (forced) return forced;
  const target = process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV;
  if (!target || target === 'production') return null;
  return target === 'preview' ? 'Vista previa' : 'Pruebas';
}
