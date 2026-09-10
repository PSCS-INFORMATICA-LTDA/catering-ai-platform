import { defineConfig, devices } from '@playwright/test'

const baseURL =
  process.env.E2E_BASE_URL?.trim() || 'https://catering-ai-agenda-dev.vercel.app'

export default defineConfig({
  testDir: 'tests/e2e/auth',
  testMatch: '[0-9]*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['json', { outputFile: 'tests/e2e/auth/playwright-report.json' }]],
  globalSetup: './tests/e2e/auth/global-setup.ts',
  globalTeardown: './tests/e2e/auth/global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'auth-harness',
      testMatch: '[0-9]*.spec.ts',
    },
  ],
})
