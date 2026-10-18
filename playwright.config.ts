import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in a real browser.
 *
 *   npm run test:e2e               # single player, mobile and desktop
 *   npm run test:e2e:multiplayer   # two separate browsers against the Firebase emulators
 *
 * The game runs on Vite's dev server, which exposes the test hooks
 * (window.__scc) used to hand a run to the simulated player.
 */
const SINGLE_PORT = 5180
const ONLINE_PORT = 5181

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${SINGLE_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: /multiplayer\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      testIgnore: /multiplayer\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } },
    },
    {
      name: 'multiplayer',
      testMatch: /multiplayer\.spec\.ts/,
      timeout: 360_000,
      use: { ...devices['Pixel 7'], baseURL: `http://127.0.0.1:${ONLINE_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${SINGLE_PORT} --strictPort`,
      url: `http://127.0.0.1:${SINGLE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Talks to the local Firebase emulators (see .env.emulator).
      command: `npx vite --mode emulator --port ${ONLINE_PORT} --strictPort`,
      url: `http://127.0.0.1:${ONLINE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
