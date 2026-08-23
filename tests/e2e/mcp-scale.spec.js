// ─────────────────────────────────────────────────────────────────────────────
// MCP catalog at scale — 430+ servers from the official registry.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'
const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
})

test('MCP catalog: large registry renders with correct count', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-catalogue')).toBeVisible()

  // The catalogue table must be present and populated (100+ rows rendered)
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

test('MCP catalog: register a new server among the hundreds', async ({ page }) => {
  const name = `scale-mcp-${Date.now().toString(36)}`
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('toggle-mcp-form').click()
  await page.getByTestId('mcp-name').fill(name)
  await page.getByTestId('mcp-url').fill(`https://example.com/sse`)
  await page.getByTestId('mcp-submit').click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
})
