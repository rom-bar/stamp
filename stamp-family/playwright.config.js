const { defineConfig, devices } = require('@playwright/test');
const fs = require('node:fs');

const port = process.env.STAMP_E2E_PORT || '4173';
const baseURL = `http://127.0.0.1:${port}`;
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium';
const launchOptions = fs.existsSync(systemChromium) ? { executablePath: systemChromium, args: ['--no-sandbox'] } : undefined;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalTeardown: require.resolve('./tests/e2e-teardown.js'),
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    headless: true,
    ...(launchOptions ? { launchOptions } : {}),
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: 'node tests/e2e-server.js',
    url: `${baseURL}/healthz`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
