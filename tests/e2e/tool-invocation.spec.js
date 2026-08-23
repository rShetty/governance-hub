import { test, expect } from '@playwright/test'

test('Tool invocation is blocked without an allow preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('tool-invocation-console')).toBeVisible()

  await page.getByTestId('invoke-action').fill('call')
  await page.getByTestId('invoke-resource').fill('mcp/unauthorized')
  await page.getByTestId('invoke-policy').fill('- name: deny-all\n  actions: ["*"]\n  resources: ["mcp/*"]\n  decision: deny')
  await page.getByTestId('invoke-run').click()

  await expect(page.getByTestId('invoke-preview')).toContainText('"decision": "deny"')
  await expect(page.getByTestId('invoke-result')).toContainText('Blocked by policy preview.')
})

test('Tool invocation accepts when policy preview allows', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  await page.getByTestId('invoke-action').fill('call')
  await page.getByTestId('invoke-resource').fill('mcp/github')
  await page.getByTestId('invoke-policy').fill('- name: allow-github\n  actions: ["call"]\n  resources: ["mcp/*"]\n  decision: allow')
  await page.getByTestId('invoke-run').click()

  await expect(page.getByTestId('invoke-preview')).toContainText('"decision": "allow"')
  await expect(page.getByTestId('invoke-result')).toContainText('Authorized invocation accepted.')
})
