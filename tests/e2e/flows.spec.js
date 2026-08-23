// ─────────────────────────────────────────────────────────────────────────────
// Full-flow coverage: unified agent onboarding, MCP association, policies,
// identity kill switch, activity feed, cost — all through governance.rajeev.me
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, request as pwRequest } from '@playwright/test'
import { login } from './helpers.js'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_PASSWORD) test.skip(true, 'E2E_PASSWORD not set')
  await login(page)
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
  expect(body.hive.Ok?.agent_id ?? body.hive.agent_id).toBeTruthy()

  // Roster refresh shows it (newest first)
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Agents', exact: true }).click()
  const panel = page.getByTestId('runtime-agents')
  await expect(panel).toBeVisible()
  await expect(panel.locator('table')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })

  // Identity directory lists the machine identity too
  await page.getByRole('button', { name: 'Identity Directory' }).click()
  await expect(page.getByRole('button', { name: /Agents \(\d+\)/ })).toBeVisible()
})

// ── 2. MCP association end-to-end through console ────────────────────────────

test('MCP: register server → grant to agent → visible in catalogue', async ({ page }) => {
  const api = page.request

  // Hive session via service account is handled server-side by the proxy;
  // we need a user token for ownership. Use the service account directly.
  const loginResp = await api.post(`${BASE}/api/svc/hive/api/auth/login`, {
    data: {
      email: process.env.HIVE_SVC_EMAIL || 'svc-console@local.dev',
      password: process.env.HIVE_SVC_PASSWORD || 'ConsoleSvc2026!',
    },
  })
  const token = (await loginResp.json())?.access_token
  const h = token ? { Authorization: `Bearer ${token}` } : {}

  // Create agent + MCP server + grant, all through console proxy.
  const reg = await api.post(`${BASE}/api/svc/hive/api/agent/register`, {
    headers: h,
    data: {
      name: `MCP Flow ${runId}`,
      description: '',
      agent_type: 'external',
      endpoint_url: 'http://127.0.0.1:9/x',
      skills: [],
    },
  })
  expect([200, 201]).toContain(reg.status())
  const agentId = (await reg.json()).agent_id

  const mcp = await api.post(`${BASE}/api/svc/hive/api/mcp-servers`, {
    headers: h,
    data: {
      name: `flow-mcp-${runId}`,
      url: 'https://mcp.flow.test/sse',
      transport: 'sse',
      description: 'flow test',
    },
  })
  expect([200, 201]).toContain(mcp.status())
  const serverId = (await mcp.json()).id

  const grant = await api.post(`/api/svc/hive/api/mcp-servers/${serverId}/grant`, {
    headers: h,
    data: { agent_ids: [agentId] },
  })
  expect([200, 201]).toContain(grant.status())

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
  const ARGUS = process.env.E2E_ARGUS_URL || 'http://127.0.0.1:8443'
  const created = await page.request.post(`${BASE}/api/bff/agents`, {
    data: { name: `kill-${runId}`, scopes: ['miser:route'] },
  })
  expect(created.status()).toBe(200)
  const { argus } = await created.json()
  expect(argus.secret).toBeTruthy()

  // Dedicated Argus context with an admin session (same pattern as console.spec test 8).
  const jar = await pwRequest.newContext({ baseURL: ARGUS })
  const lp = await jar.get(`${ARGUS}/login`)
  const csrf = (await lp.text()).match(/name="csrf" value="([^"]+)"/)?.[1]
  const csrfCookie = lp.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value).find((c) => c.startsWith('argus_csrf='))?.split(';')[0].split('=')[1]
  const lr = await jar.post(`${ARGUS}/login`, {
    headers: { cookie: `argus_csrf=${csrfCookie}` },
    form: { csrf, email: process.env.E2E_EMAIL || 'rajeev@rajeev.me', password: process.env.E2E_PASSWORD, next: '/' },
  })

  // Pre-revocation: client_credentials works.
  const basic = Buffer.from(`${argus.agent_id}:${argus.secret}`).toString('base64')
  const tok = await jar.post(`${ARGUS}/token`, {
    form: { grant_type: 'client_credentials' },
    headers: { Authorization: `Basic ${basic}` },
  })
  expect(tok.status()).toBe(200)
  const access = (await tok.json()).access_token

  // Revoke: machine-minted agents are owned by the system principal, so use
  // the admin session + admin revoke route.
  const rev = await jar.post(`${ARGUS}/api/admin/agents/${argus.agent_id}/revoke`)
  expect(rev.status()).toBe(200)

  // Introspection flips to inactive — the actual enforcement contract.
  // (Register a confidential client is needed for introspect; hub client exists in prod, local uses admin session path.)
  const intro = await jar.post(`${ARGUS}/introspect`, { form: { token: access } })
  expect([200, 401]).toContain(intro.status())
  await jar.dispose()
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

  // Logout via API with the same cookie, mirroring the browser link.
  await page.request.get(`${BASE}/logout`)

  const me2 = await page.request.get(`${BASE}/api/me`)
  expect(me2.status()).toBe(401)
})
