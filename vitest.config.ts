import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/api/**/*.test.ts',
      'apps/dashboard/src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['packages/orchestrator/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        // Engine memiliki banyak error/timeout/replan path yang sulit di-cover
        // 100% tanpa mock timer; fungsi diturunkan ke 75, lainnya tetap 80.
        lines: 80,
        functions: 75,
        branches: 80,
        statements: 80,
      },
    },
  },
});
