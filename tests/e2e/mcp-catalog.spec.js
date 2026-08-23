// ─────────────────────────────────────────────────────────────────────────────
// MCP catalog management — list, register via UI form, verify persistence.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'
const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
})

test('MCP catalog: view renders with catalogue panel and register button', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-catalogue')).toBeVisible()
  await expect(page.getByTestId('toggle-mcp-form')).toBeVisible()
})

test('MCP catalog: register a new server through the UI form', async ({ page }) => {
  const name = `ui-mcp-${runId}`
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('toggle-mcp-form').click()
  await expect(page.getByTestId('mcp-form')).toBeVisible()

  await page.getByTestId('mcp-name').fill(name)
  await page.getByTestId('mcp-transport').selectOption('sse')
  await page.getByTestId('mcp-url').fill(`https://example.com/sse`)
  await page.getByTestId('mcp-description').fill('registered by playwright UI test')
  await page.getByTestId('mcp-submit').click()

  // Server appears immediately in the catalogue table (optimistic prepend).
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })
})

test('MCP catalog: registration persists across reload', async ({ page }) => {
  const name = `persist-mcp-${runId}`
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('toggle-mcp-form').click()
  await page.getByTestId('mcp-name').fill(name)
  await page.getByTestId('mcp-url').fill(`https://example.com/sse`)
  await page.getByTestId('mcp-submit').click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 })

  // Hard reload — data must come back from Hive (persisted), not local state.
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
})

test('MCP catalog: form validation blocks empty submission', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('toggle-mcp-form').click()
  // name + url are required; browser should block submit
  await page.getByTestId('mcp-submit').click()
  await page.waitForTimeout(500)
  // Form still open (not submitted) and no server row was created
  await expect(page.getByTestId('mcp-form')).toBeVisible()
})

test('MCP catalog: association with agent works end-to-end', async ({ page }) => {
  const api = page.request
  // Create an agent
  const reg = await api.post('/api/bff/runtime-agents', {
    data: {
      name: `assoc-agent-${runId}`,
      description: '',
      agent_type: 'external',
      endpoint_url: 'https://example.com/agent',
      skills: [],
    },
  })
  const agent = await reg.json()
  const agentId = agent.agent_id

  // Create an MCP server
  const mcpName = `assoc-mcp-${runId}`
  const mcp = await api.post('/api/bff/mcp', {
    data: { name: mcpName, url: 'https://example.com/sse', transport: 'sse' },
  })
  expect(mcp.status()).toBe(201)
  const serverId = (await mcp.json()).id

  // Associate
  const grant = await api.post(`/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })
  expect(grant.status()).toBe(200)

  // Verify the grant is visible in the API (agent has access)
  const access = await api.get(`/api/bff/mcp/${serverId}/access`)
  expect((await access.json()).agents).toContain(agentId)

  // UI shows the server in the catalogue
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByText(mcpName).first()).toBeVisible({ timeout: 15000 })
})
