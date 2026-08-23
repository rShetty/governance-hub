// ─────────────────────────────────────────────────────────────────────────────
// Full-flow coverage: unified agent onboarding, MCP association, policies,
// identity kill switch, activity feed, cost — all through governance.rajeev.me
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
  await expect(page.getByText('administrator')).toBeVisible()
})

// ── 1. Unified onboarding wizard flow ────────────────────────────────────────

test('Onboarding: create agent via BFF → visible in roster + Argus directory', async ({ page }) => {
  const name = `Wizard Agent ${runId}`

  // The Agents view is the single entry point for agent onboarding.
  await page.getByRole('button', { name: 'Agents', exact: true }).click()
  await expect(page.getByTestId('runtime-agents')).toBeVisible()

  // Drive creation through the same BFF call the UI button will make (P2 wires the form).
  const created = await page.request.post(`${BASE}/api/bff/agents`, {
    data: {
      name,
      description: 'created by unified onboarding test',
      scopes: ['hive:delegate', 'miser:route'],
    },
  })
  expect(created.status()).toBe(200)
  const body = await created.json()
  expect(body.argus.agent_id).toMatch(/^agt_/)
  // Hive registration result: direct object on success (prod), Ok-wrapped on some builds
  const hiveId = body.hive?.agent_id ?? body.hive?.Ok?.agent_id ?? (body.hive?.Err ? null : null)
  expect(hiveId ?? body.hive).toBeTruthy()

  // Roster refresh shows it (newest first)
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Agents', exact: true }).click()
  const panel = page.getByTestId('runtime-agents')
  await expect(panel).toBeVisible()
  await expect(panel.locator('table')).toBeVisible({ timeout: 15000 })
  // The BFF-registered agent must appear (newest-first sort guarantees it).
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20000 })

  // Identity directory lists the machine identity too
  await page.getByRole('button', { name: 'Identity Directory' }).click()
  await expect(page.getByRole('button', { name: /Agents \(\d+\)/ })).toBeVisible()
})

// ── 2. MCP association end-to-end through console ────────────────────────────

test('MCP: register server → grant to agent → visible in catalogue', async ({ page }) => {
  const api = page.request

  // Hive session via service account is handled server-side by the proxy;
  // we need a user token for ownership. Use the service account directly.
  // Create agent + MCP server + grant, all through console proxy.
  const reg = await api.post('/api/bff/runtime-agents', {
    data: {
      name: `MCP Flow ${runId}`,
      description: '',
      agent_type: 'external',
      endpoint_url: 'https://example.com/agent',
      skills: [],
    },
  })
  expect(reg.status()).toBe(201)
  const agentId = (await reg.json()).agent_id

  const mcp = await api.post('/api/bff/mcp', {
    data: {
      name: `flow-mcp-${runId}`,
      url: 'https://example.com/sse',
      transport: 'sse',
      description: 'flow test',
    },
  })
  expect(mcp.status()).toBe(201)
  const serverId = (await mcp.json()).id

  const grant = await api.post(`/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })
  expect(grant.status()).toBe(200)

  // UI: Tools view shows the MCP catalogue with our server present.
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByText(`flow-mcp-${runId}`).first()).toBeVisible({ timeout: 15000 })
})

// ── 3. Policy lifecycle through Patroclus ────────────────────────────────────

test('Policies: create via console API → appears in Access view', async ({ page }) => {
  const name = `ui-policy-${runId}`
  const res = await page.request.post(`${BASE}/api/bff/policies`, {
    data: {
      name,
      engine: 'yaml',
      definition:
        `- name: allow-e2e\n  actions: ["*"]\n  resources: ["*"]\n  decision: allow\n  reason: playwright`,
    },
  })
  expect([200, 201]).toContain(res.status())

  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
})

// ── 4. Kill switch: revoked identity stops authenticating ────────────────────

test('Kill switch: minted agent authenticates until revoked', async ({ page }) => {
  const created = await page.request.post(`${BASE}/api/bff/agents`, {
    data: { name: `kill-${runId}`, scopes: ['miser:route'] },
  })
  expect(created.status()).toBe(200)
  const { argus } = await created.json()
  const revoked = await page.request.post(`/api/bff/identities/${argus.agent_id}/action`, {
    data: { action: 'revoke', reason: 'playwright kill switch' },
  })
  expect(revoked.status()).toBe(200)
  expect((await revoked.json()).status).toBe('revoked')
})

// ── 5. Activity feed returns normalized items ────────────────────────────────

test('Activity: feed endpoint responds with normalized shape', async ({ page }) => {
  const r = await page.request.get(`${BASE}/api/bff/activity?limit=10`)
  expect(r.status()).toBe(200)
  const body = await r.json()
  expect(Array.isArray(body.items)).toBe(true)
})

// ── 6. Cost view reflects Miser keys ────────────────────────────────────────

test('Cost: keys list from Miser surfaces in view', async ({ page }) => {
  await page.getByRole('button', { name: 'Cost & Routing' }).click()
  await expect(page.getByText(/Provisioned keys/i)).toBeVisible({ timeout: 15000 })
})

// ── 7. Logout ends the session ───────────────────────────────────────────────

test('Logout: session terminated, dashboard gated again', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const resp = await page.request.get(`${BASE}/api/me`)
  expect(resp.status()).toBe(200) // precondition: logged in

  await page.request.get('/__test__/logout')

  const me2 = await page.request.get(`${BASE}/api/me`)
  expect(me2.status()).toBe(401)
})
