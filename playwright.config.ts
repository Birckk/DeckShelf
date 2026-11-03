import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4329',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'node node_modules/vite-plus/bin/vp dev --host 127.0.0.1 --port 4329',
    url: 'http://127.0.0.1:4329',
    reuseExistingServer: !process.env.CI,
  },
});
