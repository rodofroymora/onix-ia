import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@onix/agent',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
