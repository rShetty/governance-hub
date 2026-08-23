import { defineConfig } from '@playwright/test'

const FORGE_PORT = 18788
const HUB_PORT = 18600
process.env.E2E_BASE_URL = `http://127.0.0.1:${HUB_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${HUB_PORT}`,
    headless: true,
  },
  webServer: [
    { command: 'node tests/fixtures/local-hub-server.mjs', port: HUB_PORT, reuseExistingServer: false },
  ],
})
