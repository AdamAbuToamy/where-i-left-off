import { defineConfig, devices } from '@playwright/test'
const previewPort = Number(process.env.TEST_PREVIEW_PORT || 5173)
if (!Number.isInteger(previewPort) || previewPort < 1024 || previewPort > 65535) throw new Error('Invalid isolated preview port')
const previewUrl = `http://127.0.0.1:${previewPort}`
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1, maxFailures: process.env.CI ? 0 : 1,
  use: { actionTimeout: 8000, baseURL: previewUrl, trace: 'retain-on-failure', launchOptions: process.env.TEST_CHROMIUM_PATH ? { executablePath: process.env.TEST_CHROMIUM_PATH, args: ['--no-sandbox'] } : {} },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: `./node_modules/.bin/vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`, url: previewUrl, reuseExistingServer: false },
})
