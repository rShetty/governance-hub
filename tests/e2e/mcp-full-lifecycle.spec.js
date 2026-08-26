import { test, expect } from '@playwright/test'

// This suite only runs against the local fixture server.
const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
test.skip(!process.env.E2E_LOCAL, 'MCP lifecycle mutations require local E2E environment')

const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
  await expect(page.getByText('administrator')).toBeVisible()
})

test('MCP full lifecycle: install wizard → grant → policy → verify access → revoke', async ({ page }) => {
  // ── STEP 1: Install MCP server via wizard ──
  const serverName = `lifecycle-mcp-${runId}`
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
  await page.getByTestId('wiz-name').fill(serverName)
  await page.getByTestId('wiz-url').fill('https://mcp.lifecycle.test/sse')
  await page.getByTestId('wiz-next-1').click()
  await page.getByTestId('wiz-install-btn').click()
  await expect(page.getByTestId('wiz-installed-ok')).toBeVisible({ timeout: 10000 })
  await page.getByTestId('wiz-next-2').click()

  // ── STEP 2: Create a runtime agent ──
  const agentName = `lifecycle-agent-${runId}`
  const regResponse = await page.request.post('/api/bff/runtime-agents', {
    data: { name: agentName, endpoint_url: 'https://agent.lifecycle.test' },
  })
  expect(regResponse.status()).toBe(201)
  const agent = await regResponse.json()
  const agentId = agent.agent_id

  // ── STEP 3: Grant access using the wizard-created server ──
  // The wizard already registered the server; we just need its ID.
  // We can find it from the MCP catalog API.
  const catalogResponse = await page.request.get('/api/bff/mcp')
  const catalog = await catalogResponse.json()
  const installedServer = Array.isArray(catalog) ? catalog.find(s => s.name === serverName) : null
  expect(installedServer).toBeTruthy()
  const serverId = installedServer.id
  const grantResponse = await page.request.post(`/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })
  expect(grantResponse.status()).toBe(200)

  let access = await (await page.request.get(`/api/bff/mcp/${serverId}/access`)).json()
  expect(access.agents).toContain(agentId)

  // ── STEP 4: Create an allow policy for this server ──
  const policyName = `allow-${runId}`
  const policyResponse = await page.request.post('/api/bff/policies', {
    data: {
      name: policyName,
      engine: 'yaml',
      definition: `- name: allow-${serverName}\n  actions: ["call"]\n  resources: ["${serverId}/*"]\n  decision: allow\n  reason: "MCP lifecycle test"`,
    },
  })
  expect(policyResponse.status()).toBe(201)

  await page.getByRole('button', { name: 'Access', exact: true }).click()
  await expect(page.getByText(policyName)).toBeVisible({ timeout: 10000 })

  // ── STEP 5: Simulate a tool call against this server's resource ──
  await page.getByTestId('open-policy-wizard').click()
  await expect(page.getByTestId('hub-wizard')).toBeVisible()
  await page.getByTestId('policy-name').fill(serverName)
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('policy-actions').fill('call')
  await page.getByTestId('policy-resources').fill(`${serverId}/*`)
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('simulate-action').fill('call')
  await page.getByTestId('simulate-resource').fill(`${serverId}/read_data`)
  await page.getByTestId('simulate-run').click()
  await expect(page.getByTestId('simulation-result')).toContainText('ALLOW')

  // ── STEP 6: Verify catalog shows server with authorized agents ──
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('mcp-search').fill(serverName)
  await expect(page.getByText(serverName).first()).toBeVisible({ timeout: 10000 })

  const row = page.locator('tr', { hasText: serverName }).first()
  await row.getByRole('button', { name: /Who has it/ }).click()
  await expect(page.getByTestId('access-list')).toContainText(agentId, { timeout: 10000 })

  // ── STEP 7: Revoke access ──
  await page.request.post(`/api/bff/mcp/${serverId}/revoke`, {
    data: { agent_ids: [agentId] },
  })
  const revokedAccess = await (await page.request.get(`/api/bff/mcp/${serverId}/access`)).json()
  expect(revokedAccess.agents ?? []).not.toContain(agentId)
})

test('MCP lifecycle: revoke blocks previously-granted agent', async ({ page }) => {
  const reg = await page.request.post('/api/bff/runtime-agents', {
    data: { name: `deny-agent-${runId}`, endpoint_url: 'https://example.com/agent' },
  })
  const agentId = (await reg.json()).agent_id

  const mcp = await page.request.post('/api/bff/mcp', {
    data: { name: `deny-mcp-${runId}`, url: 'https://example.com/sse', transport: 'sse' },
  })
  const serverId = (await mcp.json()).id

  await page.request.post(`/api/bff/mcp/${serverId}/grant`, { data: { agent_ids: [agentId] } })
  let access = await (await page.request.get(`/api/bff/mcp/${serverId}/access`)).json()
  expect(access.agents).toContain(agentId)

  await page.request.post(`/api/bff/mcp/${serverId}/revoke`, { data: { agent_ids: [agentId] } })
  access = await (await page.request.get(`/api/bff/mcp/${serverId}/access`)).json()
  expect(access.agents ?? []).not.toContain(agentId)
})
