import { test, expect } from '@playwright/test'

test('Supply chain blocks a critical package and trusts a clean package', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Supply Chain' }).click()

  await page.getByTestId('package-name').fill('blocked-package')
  await page.getByTestId('package-version').fill('0.1.0')
  await page.getByTestId('package-publisher').fill('trusted-org')
  await page.getByTestId('package-submit').click()
  const blockedRow = page.locator('[data-testid^="supply-package-"]').last()
  await blockedRow.getByRole('button').click()
  await expect(page.getByTestId('release-decision')).toContainText('blocked')

  await page.getByTestId('package-name').fill('clean-package')
  await page.getByTestId('package-version').fill('1.0.0')
  await page.getByTestId('package-publisher').fill('trusted-org')
  await page.getByTestId('package-submit').click()
  const cleanRow = page.locator('[data-testid^="supply-package-"]').last()
  await cleanRow.getByRole('button').click()
  await expect(page.getByTestId('release-decision')).toContainText('deployable')
})
