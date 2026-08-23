import { test, expect } from '@playwright/test'

test('Tools view merges Relay and Hive capabilities into one catalog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  await expect(page.getByTestId('unified-catalog')).toBeVisible()
  await expect(page.getByTestId('catalog-relay-connector')).toContainText('GitHub connector')
  await expect(page.getByTestId('catalog-hive-mcp-server')).toContainText('Fixture MCP server')
})
