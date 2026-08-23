import { test, expect } from '@playwright/test'

test('Compliance reports switch between frameworks', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Compliance' }).click()
  await expect(page.getByTestId('compliance-report')).toContainText('"framework": "soc2"')

  await page.getByTestId('framework-gdpr').click()
  await expect(page.getByTestId('compliance-report')).toContainText('"framework": "gdpr"')
})
