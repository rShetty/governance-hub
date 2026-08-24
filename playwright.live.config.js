import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 15_000,
  workers: 4,
  reporter: 'line',
})
