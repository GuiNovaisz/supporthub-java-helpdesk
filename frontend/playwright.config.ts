import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['junit', { outputFile: 'test-results/e2e.xml' }]],
  use: {
    actionTimeout: 8_000,
    baseURL: process.env.SUPPORTHUB_BASE_URL ?? 'http://127.0.0.1:8080',
    browserName: 'chromium',
    viewport: { width: 1440, height: 960 },
    colorScheme: 'light',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})
