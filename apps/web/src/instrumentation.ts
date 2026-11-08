export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // No bloquear ni tumbar el arranque: si la base aún no está lista,
    // se reintenta en el login, en el layout o en /api/health.
    const { tryEnsureDemoReady } = await import('./lib/ensure-demo');
    void tryEnsureDemoReady();
  }
}
