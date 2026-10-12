import { defineConfig } from '@playwright/test';
const databaseUrl = 'postgres://riskhot:riskhot-local@127.0.0.1:55432/riskhot_e2e';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: '05-场景验证/browser-results.json' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4313',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node --import tsx tests/e2e/setup.ts && node --import tsx apps/api/src/main.ts',
      url: 'http://127.0.0.1:4312/health',
      reuseExistingServer: false,
      env: { DATABASE_URL: databaseUrl, API_PORT: '4312', WEB_ORIGIN: 'http://127.0.0.1:4313' },
    },
    {
      command: 'pnpm exec vite --config apps/web/vite.config.ts',
      url: 'http://127.0.0.1:4313',
      reuseExistingServer: false,
      env: { API_PORT: '4312', WEB_PORT: '4313' },
    },
  ],
});
