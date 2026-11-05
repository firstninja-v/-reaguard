import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './browser', fullyParallel: true, workers: 2,
  use: { viewport: { width: 900, height: 650 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
