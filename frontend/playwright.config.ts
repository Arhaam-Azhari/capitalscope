import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'workspace.spec.ts',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:5186', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186', reuseExistingServer: !process.env.CI
  }
});
