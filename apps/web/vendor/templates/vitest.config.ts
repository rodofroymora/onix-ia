import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@onix/templates',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
