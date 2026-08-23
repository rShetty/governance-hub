import { test, expect } from '@playwright/test'

test('Operators mint machine identities without exposing secrets in the UI', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()

  await page.getByTestId('identity-name').fill('playwright-identity')
  await page.getByTestId('identity-scopes').fill('relay:call,miser:route')
  await page.getByTestId('identity-mint-submit').click()

  await expect(page.getByTestId('identity-action-result')).toContainText('minted')
  await expect(page.getByTestId('identity-action-result')).toContainText('secure operator channel')
})
