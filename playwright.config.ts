import { defineConfig, devices } from '@playwright/test'

// End-to-end tests of the real screens, in single-phone mode (no Supabase) with fixed test data.
// TVmaze and the movie function are answered from fixtures, so runs are repeatable and offline-safe.
const PORT = 5299
// Sign-in screens only exist with Supabase: a second copy runs against a pretend Supabase (tests/e2e-cloud)
const CLOUD_PORT = 5300

export default defineConfig({
  testDir: 'tests',
  testMatch: /e2e(-cloud)?\/.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/e2e-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-safari', testDir: 'tests/e2e', use: { ...devices['iPhone 14'] } },
    { name: 'android-chrome', testDir: 'tests/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-safari-cloud', testDir: 'tests/e2e-cloud', use: { ...devices['iPhone 14'], baseURL: `http://localhost:${CLOUD_PORT}` } },
    { name: 'android-chrome-cloud', testDir: 'tests/e2e-cloud', use: { ...devices['Pixel 7'], baseURL: `http://localhost:${CLOUD_PORT}` } },
  ],
  webServer: [
    {
      // Empty Supabase settings = single-phone mode, so tests never touch the real family data
      command: `npx vite --port ${PORT} --strictPort`,
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_KEY: '' },
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // A fake address the tests answer themselves: nothing ever reaches the real Supabase
      command: `npx vite --port ${CLOUD_PORT} --strictPort`,
      env: { VITE_SUPABASE_URL: 'http://supabase.test', VITE_SUPABASE_KEY: 'test-key' },
      url: `http://localhost:${CLOUD_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
