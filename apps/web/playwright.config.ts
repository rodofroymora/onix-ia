import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec next start --port ' + PORT,
    url: baseURL + '/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_SECRET: process.env.AUTH_SECRET,
      RESPONDENT_TOKEN_SECRET: process.env.RESPONDENT_TOKEN_SECRET,
      DEMO_PASSWORD: process.env.DEMO_PASSWORD,
      PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR ?? path.join(repoRoot, '.data/govern.pg'),
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
