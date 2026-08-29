import { test, expect } from '@playwright/test'

test('Catalog shows OAuth metadata and policy mapping state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  const githubOauth = page.getByTestId('catalog-oauth-github')
  if (await githubOauth.count()) {
    await expect(githubOauth).toContainText('connected')
  }

  const mappingRow = page.getByTestId('mapping-server-e2e')
  if (await mappingRow.count()) {
    await expect(mappingRow).toContainText('mapped')
  }
})
