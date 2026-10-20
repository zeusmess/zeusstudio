import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in a real browser.
 *
 *   npm run test:e2e   # starts the Firebase emulators, then runs both projects
 *
 * "offline" plays without Firebase settings (progress on the device);
 * "online" plays against the local Auth and Database emulators.
 */
const OFFLINE_PORT = 5182
const ONLINE_PORT = 5183

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
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'offline',
      testMatch: /offline\.spec\.js/,
      use: { ...devices['Pixel 7'], baseURL: `http://127.0.0.1:${OFFLINE_PORT}` },
    },
    {
      name: 'online',
      testMatch: /online\.spec\.js/,
      timeout: 240_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, baseURL: `http://127.0.0.1:${ONLINE_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${OFFLINE_PORT} --strictPort`,
      url: `http://127.0.0.1:${OFFLINE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite --mode emulator --port ${ONLINE_PORT} --strictPort`,
      url: `http://127.0.0.1:${ONLINE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
