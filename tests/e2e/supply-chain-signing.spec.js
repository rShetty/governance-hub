import { test, expect } from '@playwright/test'

test('Supply chain generates keys, signs a package, and verifies the signature', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Supply Chain' }).click()

  await page.getByTestId('package-open').click()
  await page.getByTestId('package-name').fill('signed-package')
  await page.getByTestId('package-version').fill('1.0.0')
  await page.getByTestId('package-publisher').fill('trusted-org')
  await page.getByTestId('package-submit').click()

  const row = page.locator('[data-testid^="supply-package-"]').last()
  const packageId = (await row.getAttribute('data-testid')).replace('supply-package-', '')
  await row.getByRole('button', { name: 'Trust' }).click()

  await page.getByTestId('generate-key').click()
  await expect(page.getByTestId('signing-key-state')).toContainText('Private key retained only in this browser session')

  await page.getByRole('button', { name: 'Sign package' }).click()
  await expect(page.getByText('sign completed.')).toBeVisible()

  // Re-open trust for the exact signed package.
  await page.getByTestId(`trust-${packageId}`).click()
  await expect(page.getByTestId('release-decision')).toContainText('deployable')

  await page.getByRole('button', { name: 'Verify signature' }).click()
  await expect(page.getByText('verify completed.')).toBeVisible()
  await expect(page.getByTestId('signature-result')).toContainText('Signature valid: true')

  await expect(row).toContainText('signed')
})
