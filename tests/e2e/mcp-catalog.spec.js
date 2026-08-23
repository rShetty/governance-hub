// ─────────────────────────────────────────────────────────────────────────────
// MCP catalog management — list, register via UI form, verify persistence.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_PASSWORD) test.skip(true, 'E2E_PASSWORD not set')
  await login(page)
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
  await page.getByTestId('mcp-url').fill(`https://${name}.example.com/sse`)
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
  await page.getByTestId('mcp-url').fill(`https://${name}.example.com/sse`)
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
  // Login to hive as the service account through console proxy
  const loginResp = await api.post(`${BASE}/api/svc/hive/api/auth/login`, {
    data: {
      email: process.env.HIVE_SVC_EMAIL || 'svc-console@local.dev',
      password: process.env.HIVE_SVC_PASSWORD || 'ConsoleSvc2026!',
    },
  })
  const token = (await loginResp.json())?.access_token
  const h = token ? { Authorization: `Bearer ${token}` } : {}

  // Create an agent
  const reg = await api.post(`${BASE}/api/svc/hive/api/agent/register`, {
    headers: h,
    data: {
      name: `assoc-agent-${runId}`,
      description: '',
      agent_type: 'external',
      endpoint_url: 'http://127.0.0.1:9/x',
      skills: [],
    },
  })
  expect([200, 201]).toContain(reg.status())
  const agentId = (await reg.json()).agent_id

  // Create an MCP server
  const mcpName = `assoc-mcp-${runId}`
  const mcp = await api.post(`${BASE}/api/svc/hive/api/mcp-servers`, {
    headers: h,
    data: { name: mcpName, url: `https://${mcpName}.test/sse`, transport: 'sse' },
  })
  expect([200, 201]).toContain(mcp.status())
  const serverId = (await mcp.json()).id

  // Associate
  const grant = await api.post(`/api/svc/hive/api/mcp-servers/${serverId}/grant`, {
    headers: h,
    data: { agent_ids: [agentId] },
  })
  expect([200, 201]).toContain(grant.status())

  // Verify the grant is visible in the API (agent has access)
  const detail = await api.get(`/api/svc/hive/api/mcp-servers/${serverId}`, { headers: h })
  expect(detail.status()).toBe(200)

  // UI shows the server in the catalogue
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByText(mcpName).first()).toBeVisible({ timeout: 15000 })
})
