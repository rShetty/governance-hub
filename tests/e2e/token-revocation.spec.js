import { test, expect } from '@playwright/test'

test('Access operators revoke a Patroclus token with a reason', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByTestId('token-revocation')).toBeVisible()

  const answers = ['token-e2e-jti', 'credential rotation']
  let index = 0
  page.on('dialog', dialog => dialog.accept(answers[index++]))
  await page.getByRole('button', { name: 'Select token' }).click()

  await expect(page.getByText('Token token-e2e-jti revoked.')).toBeVisible()
})
