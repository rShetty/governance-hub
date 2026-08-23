import { test, expect } from '@playwright/test'

test('Supply chain package trust workflow completes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Supply Chain' }).click()

  await page.getByTestId('package-name').fill('trusted-package')
  await page.getByTestId('package-version').fill('1.0.0')
  await page.getByTestId('package-publisher').fill('trusted-org')
  await page.getByTestId('package-submit').click()

  const row = page.locator('[data-testid^="supply-package-"]').first()
  await expect(row).toBeVisible()
  const rowId = await row.getAttribute('data-testid')
  const packageId = rowId.replace('supply-package-', '')
  await page.getByTestId(`trust-${packageId}`).click()

  await page.getByRole('button', { name: 'Generate SBOM' }).click()
  await expect(page.getByText('sbom completed.')).toBeVisible()
  await page.getByRole('button', { name: 'Scan' }).click()
  await expect(page.getByText('scan completed.')).toBeVisible()
  await page.getByRole('button', { name: 'Set provenance' }).click()
  await expect(page.getByText('provenance completed.')).toBeVisible()
  await expect(page.getByTestId('trust-json')).toContainText('publisher_trusted')
})
