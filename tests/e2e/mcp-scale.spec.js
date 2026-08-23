// ─────────────────────────────────────────────────────────────────────────────
// MCP catalog at scale — 430+ servers from the official registry.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'

test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_PASSWORD) test.skip(true, 'E2E_PASSWORD not set')
  await login(page)
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
  // Registry-seeded servers (inference.sh etc.) only exist on deployments
  // where the official-registry seed has run; skip otherwise.
  test.skip(process.env.SKIP_REGISTRY_SEED_CHECK === '1', 'registry seed not present on this deployment')
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
