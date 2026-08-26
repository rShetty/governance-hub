import { test, expect } from '@playwright/test'

test('Identity lifecycle revokes and restores a machine identity', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()

  const row = page.getByTestId('identity-agt_e2e_001')
  await expect(row).toContainText('armed')

  await page.getByTestId('identity-revoke-agt_e2e_001').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-reason').fill('release containment test')
  await page.getByRole('button', { name: 'Revoke identity' }).click()
  await expect(page.getByTestId('hub-modal')).toBeHidden()
  await expect(row).toContainText('revoked', { timeout: 15000 })

  await page.getByTestId('identity-restore-agt_e2e_001').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-reason').fill('restore after verification')
  await page.getByRole('button', { name: 'Restore identity' }).click()
  await expect(row).toContainText('armed')
})
