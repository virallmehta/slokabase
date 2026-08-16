import { defineConfig, devices } from '@playwright/test'

// Real-browser verification for this app — distinct from vitest's
// logic-only unit tests (see frontend/CLAUDE.md's Testing section).
// Requires the backend to already be running separately (`cd backend &&
// npm run dev`) against a DB you're fine with tests touching — this
// project has no test-only backend instance, so point it at a throwaway/
// dev database, not production. The frontend dev server is started
// automatically below.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Specs across different files can still mutate shared global state
  // concurrently (e.g. two specs both reading/restoring app_name) even
  // with fullyParallel: false, which only serializes *within* one file —
  // this app has exactly one admin account and one settings row, so
  // force every spec file onto a single worker rather than add
  // per-spec locking for state this narrow.
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
