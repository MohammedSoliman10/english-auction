import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Constitution III — coverage thresholds are enforced here (mirrors the
 * frontend config): ≥95% lines, ≥90% branches over production sources
 * (`backend/src/**` + the Vercel functions in `api/`); test helpers are not
 * the coverage target, exactly like the contracts gate counts
 * `contracts/src` only (T066/T069).
 *
 * `root` is the repo so the `../api` function files are inside the scanned
 * tree (vitest only reports coverage for files under root); the test
 * `include` is narrowed back to this workspace's suite.
 */
export default defineConfig({
  test: {
    root: path.resolve(import.meta.dirname, '..'),
    include: ['backend/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['backend/src/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/test/**', '**/*.test.ts'],
      reportsDirectory: path.resolve(import.meta.dirname, 'coverage'),
      thresholds: { lines: 95, branches: 90 },
    },
  },
});
