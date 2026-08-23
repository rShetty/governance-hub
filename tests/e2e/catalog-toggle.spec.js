import { test, expect } from '@playwright/test'

test('Operators toggle Relay backends from the catalog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  await page.getByTestId('toggle-github').click()
  await expect(page.getByTestId('catalog-health-result')).toContainText('GitHub connector: disabled')
})
