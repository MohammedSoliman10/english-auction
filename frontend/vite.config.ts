/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // T027: dev parity with production single-origin (backend serves /api + /rpc)
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/rpc': 'http://localhost:3000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts'],
      // Constitution III: >=95% lines, >=90% branches (enforced at coverage gate)
      thresholds: { lines: 95, branches: 90 },
    },
  },
});
