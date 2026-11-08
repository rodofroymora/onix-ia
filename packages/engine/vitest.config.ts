import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@onix/engine',
    include: ['tests/**/*.test.ts'],
  },
});
