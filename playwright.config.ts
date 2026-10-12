import { defineConfig, devices } from '@playwright/test'

// End-to-end tests of the real screens, in single-phone mode (no Supabase) with fixed test data.
// TVmaze and the movie function are answered from fixtures, so runs are repeatable and offline-safe.
const PORT = 5299

export default defineConfig({
  testDir: 'tests/e2e',
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
    { name: 'iphone-safari', use: { ...devices['iPhone 14'] } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Empty Supabase settings = single-phone mode, so tests never touch the real family data
    command: `npx vite --port ${PORT} --strictPort`,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_KEY: '' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
