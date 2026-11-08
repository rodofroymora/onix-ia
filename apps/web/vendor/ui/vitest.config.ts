import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@onix/ui',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
