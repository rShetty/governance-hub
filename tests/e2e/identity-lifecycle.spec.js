import { test, expect } from '@playwright/test'

test('Identity lifecycle revokes and restores a machine identity', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()

  const row = page.getByTestId('identity-agt_e2e_001')
  await expect(row).toContainText('armed')

  page.once('dialog', dialog => dialog.accept('release containment test'))
  await page.getByTestId('identity-revoke-agt_e2e_001').click()
  await expect(row).toContainText('revoked')

  page.once('dialog', dialog => dialog.accept('restore after verification'))
  await page.getByTestId('identity-restore-agt_e2e_001').click()
  await expect(row).toContainText('armed')
})
