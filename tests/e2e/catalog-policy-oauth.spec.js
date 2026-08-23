import { test, expect } from '@playwright/test'

test('Catalog shows OAuth metadata and policy mapping state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  await expect(page.getByTestId('catalog-oauth-github')).toContainText('connected')
  await expect(page.getByTestId('mapping-server-e2e')).toContainText('mapped')
})
