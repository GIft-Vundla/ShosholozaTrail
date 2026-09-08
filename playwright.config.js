import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  testIgnore: ['**/provider-recovery.spec.js'],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node harness/static-server.js',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
