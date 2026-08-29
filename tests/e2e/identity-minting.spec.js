import { test, expect } from '@playwright/test'

test('Operators mint machine identities without exposing secrets in the UI', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Agents', exact: true }).click()

  await page.getByTestId('open-identity-dialog').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-name').fill('playwright-identity')
  await page.getByTestId('dialog-scopes').fill('relay:call,miser:route')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Mint identity' }).click()

  await expect(page.getByTestId('identity-action-result')).toContainText('minted')
  await expect(page.getByTestId('identity-action-result')).toContainText('secure operator channel')
})
