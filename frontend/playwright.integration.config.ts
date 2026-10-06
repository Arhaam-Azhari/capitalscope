import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'packaged.integration.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8097', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    command: 'java -jar ../backend/target/capitalscope-0.1.0.jar',
    env: { PORT: '8097', SEC_USER_AGENT: '', DATABASE_URL: 'jdbc:h2:mem:integration' },
    url: 'http://127.0.0.1:8097/api/universe',
    reuseExistingServer: false
  }
});
