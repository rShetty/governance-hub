// ─────────────────────────────────────────────────────────────────────────────
// MCP install lifecycle through the UI: grant → inspect access → revoke.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)
// Stable per-test unique tag (test index is constant across the test body).
const utag = () => `${test.info().title.replace(/\W+/g, '')}-${runId}`

test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_PASSWORD) test.skip(true, 'E2E_PASSWORD not set')
  await login(page)
})

let _svcTokenCache = null
async function svcToken(api) {
  if (_svcTokenCache) return _svcTokenCache
  const resp = await api.post(`${BASE}/api/svc/hive/api/auth/login`, {
    data: {
      email: process.env.HIVE_SVC_EMAIL || 'svc-console@local.dev',
      password: process.env.HIVE_SVC_PASSWORD || 'ConsoleSvc2026!',
    },
  })
  _svcTokenCache = (await resp.json())?.access_token
  return _svcTokenCache
}

async function createAgentAndServer(page) {
  const api = page.request
  const token = await svcToken(api)
  const h = { Authorization: `Bearer ${token}` }

  let reg = await api.post(`${BASE}/api/svc/hive/api/agent/register`, {
    headers: h,
    data: {
      name: `ilagent-${runId}`,
      description: '',
      agent_type: 'external',
      endpoint_url: 'https://example.com/agent',
      skills: [],
    },
  })
  if (![200, 201].includes(reg.status())) {
    console.log('register retry after:', reg.status(), (await reg.text()).slice(0, 100))
    await new Promise((r) => setTimeout(r, 2000))
    reg = await api.post(`${BASE}/api/svc/hive/api/agent/register`, {
      headers: h,
      data: {
        name: `ilagent-${runId}`,
        description: '',
        agent_type: 'external',
        endpoint_url: 'https://example.com/agent',
        skills: [],
      },
    })
  }
  expect([200, 201]).toContain(reg.status())
  const agentId = (await reg.json()).agent_id

  const mcp = await api.post(`${BASE}/api/svc/hive/api/mcp-servers`, {
    headers: h,
    data: {
      name: `ilmcp-${utag()}`,
      url: 'https://example.com/sse',
      transport: 'sse',
      description: 'install lifecycle test',
    },
  })
  expect([200, 201]).toContain(mcp.status())
  const serverId = (await mcp.json()).id
  return { agentId, serverId }
}

test('Install: grant button gives an agent access to a catalog server', async ({ page }) => {
  const { agentId, serverId } = await createAgentAndServer(page)

  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-table')).toBeVisible({ timeout: 30000 })

  // Find the row for our server; click Grant and answer the prompt with our agent id
  const row = page.locator('tr', { hasText: `ilmcp-${utag()}` }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  let capturedAgentId = null
  page.on('dialog', async (d) => {
    capturedAgentId = d.message().includes('Grant') ? agentId : ''
    await d.accept(agentId)
  })
  await row.getByRole('button', { name: /Grant → agent/ }).click()
  await page.waitForTimeout(1500)

  // Verify the grant landed via the access list API
  const access = await page.request.get(`${BASE}/api/bff/mcp/${serverId}/access`)
  expect(access.status()).toBe(200)
  const body = await access.text()
  expect(body).toContain(agentId)
})

test('Install: “Who has it?” lists agents with access', async ({ page }) => {
  const { agentId, serverId } = await createAgentAndServer(page)
  const uniqueTag = `ilmcp-${utag()}`

  // Grant first via the console API (setup) — this is what the UI button does.
  const grant = await page.request.post(`${BASE}/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })

  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-table')).toBeVisible({ timeout: 30000 })

  const row = page.locator('tr', { hasText: uniqueTag }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  const allNames = await page.locator('[data-testid="mcp-table"] tbody tr td:first-child').allTextContents()
  console.log('DBG rows:', allNames.length, '| our tag in rows:', allNames.some(n => n.includes(uniqueTag)))
  await row.getByRole('button', { name: 'Who has it?' }).click()

  await expect(page.getByTestId('access-list')).toBeVisible({ timeout: 15000 })
  // The access list fetch is async — wait until our agent appears.
  await expect(page.getByTestId('access-list')).toContainText(agentId, { timeout: 15000 })
})

test('Install: revoke removes agent access', async ({ page }) => {
  const { agentId, serverId } = await createAgentAndServer(page)

  // Grant then revoke via the console API; assert both succeed.
  const grant = await page.request.post(`${BASE}/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })
  expect(grant.status()).toBe(200)

  // Confirm present before revoke
  let access = await page.request.get(`${BASE}/api/bff/mcp/${serverId}/access`)
  expect((await access.text())).toContain(agentId)

  const rev = await page.request.post(`${BASE}/api/bff/mcp/${serverId}/revoke`, {
    data: { agent_ids: [agentId] },
  })
  expect(rev.status()).toBe(200)

  // After revoke: Hive soft-revokes (row stays, enabled=false). Parse and
  // assert no ENABLED row remains for the agent.
  access = await page.request.get(`${BASE}/api/bff/mcp/${serverId}/access`)
  const rows = await access.json()
  const enabledRows = rows.filter((r) => r.agent_id === agentId && r.enabled)
  expect(enabledRows).toHaveLength(0)
})

function dialog_handler(page) {
  page.on('dialog', (d) => d.accept(''))
}
