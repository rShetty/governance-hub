import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto('/')
})

test('MCP grant/revoke use accessible dialogs and toast feedback instead of native prompts', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('mcp-search').fill('Fixture MCP server')
  await expect(page.getByText('Fixture MCP server').first()).toBeVisible()

  // Grant via dialog
  await page.getByTestId('mcp-grant-server-e2e').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').fill('agt_dialog_001')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Grant access' }).click()
  await expect(page.getByTestId('toast-success')).toContainText('Access granted.')
  await expect(page.getByTestId('hub-modal')).not.toBeVisible()

  const granted = await (await page.request.get('/api/bff/mcp/server-e2e/access')).json()
  expect(granted.agents).toContain('agt_dialog_001')

  // Revoke via dialog
  await page.getByTestId('mcp-revoke-server-e2e').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').fill('agt_dialog_001')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Revoke access' }).click()
  await expect(page.getByTestId('toast-success').filter({ hasText: 'Access revoked.' })).toBeVisible()
  await expect(page.getByTestId('hub-modal')).not.toBeVisible()

  const revoked = await (await page.request.get('/api/bff/mcp/server-e2e/access')).json()
  expect(revoked.agents ?? []).not.toContain('agt_dialog_001')
})