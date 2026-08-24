import { test, expect } from '@playwright/test'
const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
})

test('MCP catalog: view renders with catalogue panel and install button', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-catalogue')).toBeVisible()
  await expect(page.getByTestId('install-mcp-btn')).toBeVisible()
})

test('MCP catalog: register a new server through the install wizard', async ({ page }) => {
  const name = `ui-mcp-${runId}`
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
  await page.getByTestId('wiz-name').fill(name)
  await page.getByTestId('wiz-url').fill('https://example.com/sse')
  await page.getByTestId('wiz-next-1').click()
  await page.getByTestId('wiz-install-btn').click()
  await expect(page.getByTestId('wiz-installed-ok')).toBeVisible({ timeout: 10000 })
  await page.getByTestId('wiz-next-2').click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByTestId('wiz-done')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('wiz-finish').click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
})

test('MCP catalog: registration persists across reload', async ({ page }) => {
  const name = `persist-mcp-${runId}`
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
  await page.getByTestId('wiz-name').fill(name)
  await page.getByTestId('wiz-url').fill('https://example.com/sse')
  await page.getByTestId('wiz-next-1').click()
  await page.getByTestId('wiz-install-btn').click()
  await expect(page.getByTestId('wiz-installed-ok')).toBeVisible({ timeout: 10000 })
  await page.getByTestId('wiz-next-2').click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByTestId('wiz-done')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('wiz-finish').click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('mcp-search').fill(name)
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
})

test('MCP catalog: wizard requires name and URL before Next', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
  const nextBtn = page.getByTestId('wiz-next-1')
  await expect(nextBtn).toBeDisabled()
})

test('MCP catalog: association with agent works end-to-end', async ({ page }) => {
  const api = page.request
  const reg = await api.post('/api/bff/runtime-agents', {
    data: { name: `assoc-agent-${runId}`, endpoint_url: 'https://example.com/agent' },
  })
  const agent = await reg.json()
  const agentId = agent.agent_id
  const mcpName = `assoc-mcp-${runId}`
  const mcp = await api.post('/api/bff/mcp', {
    data: { name: mcpName, url: 'https://example.com/sse', transport: 'sse' },
  })
  expect(mcp.status()).toBe(201)
  const serverId = (await mcp.json()).id
  const grant = await api.post(`/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })
  expect(grant.status()).toBe(200)
  const access = await api.get(`/api/bff/mcp/${serverId}/access`)
  expect((await access.json()).agents).toContain(agentId)

  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('mcp-search').fill(mcpName)
  await expect(page.getByText(mcpName).first()).toBeVisible({ timeout: 15000 })
})
