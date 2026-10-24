import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1, maxFailures: process.env.CI ? 0 : 1,
  use: { actionTimeout: 8000, baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', launchOptions: process.env.TEST_CHROMIUM_PATH ? { executablePath: process.env.TEST_CHROMIUM_PATH, args: ['--no-sandbox'] } : {} },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: './node_modules/.bin/vite preview --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
})
