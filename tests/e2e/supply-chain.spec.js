import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_PASSWORD) test.skip(true, 'E2E_PASSWORD not set')
  await login(page)
})

test('Supply Chain renders Hub-owned Forge flows', async ({ page }) => {
  await page.getByRole('button', { name: 'Supply Chain' }).click()
  await expect(page.getByRole('heading', { name: 'Supply Chain' })).toBeVisible()
  await expect(page.getByTestId('supply-packages')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('package-form')).toBeVisible()
  await expect(page.getByTestId('publisher-form')).toBeVisible()
  await expect(page.getByTestId('supply-publishers')).toBeVisible()
})

test('Supply Chain registers a package through the UI', async ({ page }) => {
  const name = `ui-package-${runId}`
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Supply Chain' }).click()
  await page.getByTestId('package-name').fill(name)
  await page.getByTestId('package-version').fill('1.0.0')
  await page.getByTestId('package-publisher').fill(`playwright-${runId}`)
  await page.locator('[data-testid="package-form"] button[type="submit"]').click()

  if (await page.getByTestId('supply-empty').isVisible().catch(() => false)) {
    test.skip(true, 'Forge is not available on this deployment')
  }
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
})
