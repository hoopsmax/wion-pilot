import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    // Temporary for M0: there are no unit tests yet. Remove this once the first one exists,
    // so that a run which finds no tests fails loudly instead of passing.
    passWithNoTests: true,
  },
});
