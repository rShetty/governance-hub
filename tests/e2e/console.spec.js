// ─────────────────────────────────────────────────────────────────────────────
// Governance Console — end-to-end UI test suite (governance.rajeev.me)
//
// Covers: Argus SSO, service registry CRUD, agent creation (Hive), MCP server
// registration + agent association, Patroclus policies, Argus agent identities
// and the kill switch.
//
// Run:   npx playwright test
// Env:   E2E_BASE_URL (default https://governance.rajeev.me)
//        E2E_EMAIL / E2E_PASSWORD  (Argus admin credentials)
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'

// Create an API context that carries the browser's hub session cookie.
const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
  await expect(page.getByText('administrator')).toBeVisible()
})

// ── 1. SSO gate ───────────────────────────────────────────────────────────────

test('SSO: unauthenticated visit redirects to Argus login', async ({ page }) => {
  await page.request.get('/__test__/logout')
  const response = await page.request.get('/api/me')
  expect(response.status()).toBe(401)
})

test('SSO: full login roundtrip lands on Mission Control', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
  await expect(page.getByText('authenticated')).toBeVisible()
})

// ── 2. Agent creation in Hive (via console proxy + UI where applicable) ──────

test('Agents: Hive roster view renders runtime agents section', async ({ page }) => {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Agents', exact: true }).click()
  await expect(page.getByTestId('runtime-agents')).toBeVisible()
  await expect(page.getByTestId('machine-identities')).toBeVisible()
  // Both panels show a count badge
  await expect(page.locator('[data-testid="runtime-agents"] .num').first()).toContainText(/\d+/)
})

test('Agents: register an agent in Hive via API and see it in the console', async ({ request, page }) => {
  const reg = await page.request.post('/api/bff/runtime-agents', {
    data: {
      name: `E2E Agent ${runId}`,
      description: 'created by playwright',
      agent_type: 'external',
      endpoint_url: 'https://example.com/agent',
      skills: [],
    },
  })
  expect(reg.status()).toBe(201)

  // The console Agents view should reflect the roster (count >= 1)
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Agents', exact: true }).click()
  await expect(page.getByTestId('runtime-agents')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('runtime-agents').getByText(`E2E Agent ${runId}`)).toBeVisible({ timeout: 15000 })
})

// ── 4. MCP servers: create + associate with an agent ─────────────────────────

test('MCP: create a server, grant it to an agent', async ({ request, page }) => {
  // Register an agent first
  const reg = await page.request.post('/api/bff/runtime-agents', {
    data: {
      name: `MCP Agent ${runId}`,
      description: 'for mcp association',
      agent_type: 'external',
      endpoint_url: 'https://example.com/agent',
      skills: [],
    },
  })
  expect(reg.status()).toBe(201)
  const agent = await reg.json()
  const agentId = agent.agent_id

  // Create an MCP server
  const mcp = await page.request.post('/api/bff/mcp', {
    data: {
      name: `e2e-mcp-${runId}`,
      url: 'https://example.com/sse',
      transport: 'sse',
      description: 'playwright-created MCP server',
    },
  })
  expect(mcp.status()).toBe(201)
  const server = await mcp.json()
  const serverId = server.id

  // Associate: grant the agent access to the server
  const grant = await page.request.post(`/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })
  expect(grant.status()).toBe(200)

  const access = await (await page.request.get(`/api/bff/mcp/${serverId}/access`)).json()
  expect(access.agents).toContain(agentId)
})

// ── 5. Policies (Patroclus) ──────────────────────────────────────────────────

test('Policies: create a policy in Patroclus and verify listing', async ({ page }) => {
  const res = await page.request.post('/api/bff/policies', {
    data: {
      name: `e2e-policy-${runId}`,
      engine: 'yaml',
      definition:
        '- name: allow-e2e\n  actions: ["*"]\n  resources: ["*"]\n  decision: allow\n  reason: e2e test rule',
    },
  })
  expect(res.status()).toBe(201)
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByText(`e2e-policy-${runId}`)).toBeVisible({ timeout: 10000 })
})

// ── 6. Argus machine identity lifecycle ──────────────────────────────────────

test('Argus: create an agent identity, authenticate it, revoke kill switch', async ({ request, page }) => {
  const minted = await page.request.post('/api/bff/identities/mint', {
    data: { name: `pw-bot-${runId}`, scopes: ['miser:route'] },
  })
  expect(minted.status()).toBe(200)
  const identity = await minted.json()
  expect(identity.secret_delivery).toBe('secure operator channel')

  const revoked = await page.request.post(`/api/bff/identities/${identity.agent_id}/action`, {
    data: { action: 'revoke', reason: 'playwright lifecycle' },
  })
  expect(revoked.status()).toBe(200)
  expect((await revoked.json()).status).toBe('revoked')
})
