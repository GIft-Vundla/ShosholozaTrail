import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['provider-recovery.spec.js'],
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4177',
    browserName: 'chromium',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
});
