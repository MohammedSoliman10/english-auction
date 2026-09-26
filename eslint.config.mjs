import tseslint from 'typescript-eslint';

/**
 * Root config for the Vercel function files in `/api` (ESLint 10 resolves
 * config from each linted file's directory upward — the backend/frontend
 * configs don't reach here). Mirrors backend/eslint.config.mjs rules.
 */
export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
    },
  },
);
