import { test, expect } from '@playwright/test'
const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
})

test('MCP catalog: large registry renders with correct count', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-catalogue')).toBeVisible()
  const table = page.getByTestId('mcp-table')
  await expect(table).toBeVisible({ timeout: 20000 })
  const rowCount = await table.locator('tbody tr').count()
  expect(rowCount).toBeGreaterThan(50)
})

test('MCP catalog: known registry servers are present', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-table')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('inference.sh').first()).toBeVisible({ timeout: 15000 })
})
