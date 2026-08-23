import { test, expect } from '@playwright/test'

test('Catalog shows authorized agents for MCP servers', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  await expect(page.getByTestId('catalog-agents-server-e2e')).toContainText('agt_e2e_001')
})
