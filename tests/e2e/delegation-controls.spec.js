import { test, expect } from '@playwright/test'

test('Operators issue and revoke Patroclus delegations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()

  await page.getByPlaceholder('Patroclus agent UUID').fill('00000000-0000-0000-0000-000000000002')
  await page.getByPlaceholder('relay:call,miser:route').fill('relay:call')
  await page.getByTestId('delegation-submit').click()
  await expect(page.getByText('Delegation grant_e2e_001 issued.')).toBeVisible()

  page.once('dialog', dialog => dialog.accept('grant_e2e_001'))
  await page.getByRole('button', { name: 'Revoke by ID' }).click()
  await expect(page.getByText('Grant grant_e2e_001 revoked.')).toBeVisible()
})
