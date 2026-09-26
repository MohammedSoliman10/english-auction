import { defineConfig } from 'vitest/config';

/**
 * Constitution III — coverage thresholds are enforced here (mirrors the
 * frontend config): ≥95% lines, ≥90% branches over production sources
 * (`src/**`); test helpers are not the coverage target, exactly like the
 * contracts gate counts `contracts/src` only (T066).
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 95, branches: 90 },
    },
  },
});
