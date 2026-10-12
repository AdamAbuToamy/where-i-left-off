import { defineConfig, devices } from '@playwright/test'
const softwareRendering = process.env.TEST_SOFTWARE_RENDERING === '1'
const browserArgs = [
  ...(process.env.TEST_CHROMIUM_PATH ? ['--no-sandbox'] : []),
  ...(softwareRendering ? ['--disable-gpu', '--disable-dev-shm-usage'] : []),
]
export default defineConfig({
  testDir: './tests/browser', timeout: 45000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', launchOptions: { ...(process.env.TEST_CHROMIUM_PATH ? { executablePath: process.env.TEST_CHROMIUM_PATH } : {}), args: browserArgs } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: './node_modules/.bin/vite preview --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
})
