import { test, expect } from '@playwright/test'

test('Access operators revoke a Patroclus token with a reason', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Access', exact: true }).click()

  await page.getByTestId('open-token-revocation').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()

  await page.getByTestId('dialog-token_id').fill('token-e2e-jti')
  await page.getByTestId('dialog-reason').fill('credential rotation')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Revoke token' }).click()

  await expect(page.getByTestId('toast-success')).toContainText('Token token-e2e-jti revoked.')
})
