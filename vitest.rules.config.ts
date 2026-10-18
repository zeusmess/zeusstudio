import { defineConfig } from 'vitest/config'

/** Security-rules tests; they need the emulators (npm run test:rules starts them). */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
