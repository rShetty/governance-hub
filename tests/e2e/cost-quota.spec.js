import { test, expect } from '@playwright/test'

test('Operators update Miser quotas and see an enforcement preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Cost & Routing' }).click()

  await page.getByTestId('miser-open-quota').click()
  await page.getByTestId('quota-key').fill('key_e2e_001')
  await page.getByTestId('quota-rpm').fill('120')
  await page.getByTestId('quota-budget').fill('50')

  await expect(page.getByText(/at \$50\.00 monthly and 120 rpm/i)).toBeVisible()
  await page.getByTestId('quota-submit').click()

  await expect(page.getByText('Quotas updated for key_e2e_001.')).toBeVisible()
})
