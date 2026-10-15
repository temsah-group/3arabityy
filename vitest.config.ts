import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // One in-memory MongoDB per file; downloading it the first time is slow.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
