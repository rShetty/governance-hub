import { test, expect } from '@playwright/test'

test('Access operators can inspect saved policy definitions', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()

  await expect(page.getByTestId('policy-pol_e2e_001')).toBeVisible()
  await page.getByTestId('inspect-policy-pol_e2e_001').click()
  await expect(page.getByText('Policy allow-github')).toBeVisible()
})
