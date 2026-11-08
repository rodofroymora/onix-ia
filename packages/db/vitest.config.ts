import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@onix/db',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
