import { test, expect } from '@playwright/test'

test('Supply chain associates packages with runtime agents', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Supply Chain' }).click()

  await page.getByTestId('package-name').fill('associated-package')
  await page.getByTestId('package-version').fill('1.0.0')
  await page.getByTestId('package-publisher').fill('trusted-org')
  await page.getByTestId('package-submit').click()

  const row = page.locator('[data-testid^="supply-package-"]').last()
  await row.getByRole('button', { name: 'Trust' }).click()
  await expect(page.getByTestId('package-agents')).toContainText('agent_e2e_001')

  await page.getByPlaceholder('Hive agent ID').fill('agent_playwright_001')
  await page.getByRole('button', { name: 'Associate' }).click()
  await expect(page.getByText('Associated with agent_playwright_001.')).toBeVisible()
})
