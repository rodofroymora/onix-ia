export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDemoReady } = await import('./lib/ensure-demo');
    await ensureDemoReady();
  }
}
