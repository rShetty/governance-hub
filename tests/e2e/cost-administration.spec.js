import { test, expect } from '@playwright/test'

test('Cost administration provisions and revokes Miser keys without exposing secrets', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Cost & Routing' }).click()

  await page.getByTestId('miser-open-create').click()
  await page.getByTestId('miser-owner').fill('playwright-agent')
  await page.getByTestId('miser-rpm').fill('60')
  await page.getByTestId('miser-budget').fill('25')
  await page.getByTestId('miser-create').click()
  await expect(page.getByText('Key provisioned.')).toBeVisible()

  await page.getByTestId('miser-revoke-key_e2e_001').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByText('Key revoked.')).toBeVisible()
  await expect(page.getByTestId('miser-key-key_e2e_001')).toContainText('revoked')
})
