import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5207' },
  webServer: {
    command: 'pnpm css && pnpm exec vite --host 127.0.0.1 --port 5207 --strictPort',
    port: 5207,
    reuseExistingServer: false,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
});
