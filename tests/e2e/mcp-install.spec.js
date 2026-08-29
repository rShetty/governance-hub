// ─────────────────────────────────────────────────────────────────────────────
// MCP install lifecycle through the UI: grant → inspect access → revoke.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'
const runId = Date.now().toString(36)
// Stable per-test unique tag (test index is constant across the test body).
const utag = () => `${test.info().title.replace(/\W+/g, '')}-${runId}`

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto(BASE)
})

async function createAgentAndServer(page) {
  const api = page.request
  const reg = await api.post('/api/bff/runtime-agents', {
    data: {
      name: `ilagent-${runId}`,
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
      name: `ilmcp-${utag()}`,
      url: 'https://example.com/sse',
      transport: 'sse',
      description: 'install lifecycle test',
    },
  })
  expect(mcp.status()).toBe(201)
  const serverId = (await mcp.json()).id
  return { agentId, serverId }
}

test('Install: grant button gives an agent access to a catalog server', async ({ page }) => {
  const { agentId, serverId } = await createAgentAndServer(page)

  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-table')).toBeVisible({ timeout: 30000 })

  // Search for our server to bring it to page 1
  await page.getByTestId('mcp-search').fill(`ilmcp-${utag()}`)
  const row = page.locator('tr', { hasText: `ilmcp-${utag()}` }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  const grantResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/bff/mcp/${serverId}/grant`) && response.request().method() === 'POST'
  )
  await row.getByRole('button', { name: /Grant → agent/ }).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').fill(agentId)
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Grant access' }).click()
  expect((await grantResponse).status()).toBe(200)

  // Verify the grant landed via the access list API
  const access = await page.request.get(`${BASE}/api/bff/mcp/${serverId}/access`)
  expect(access.status()).toBe(200)
  const body = await access.text()
  expect(body).toContain(agentId)
})

test('Install: “Who has it?” lists agents with access', async ({ page }) => {
  const { agentId, serverId } = await createAgentAndServer(page)
  const uniqueTag = `ilmcp-${utag()}`

  const grant = await page.request.post(`/api/bff/mcp/${serverId}/grant`, {
    data: { agent_ids: [agentId] },
  })

  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('mcp-table')).toBeVisible({ timeout: 30000 })

  // Search for the server to bring it to the current page
  await page.getByTestId('mcp-search').fill(uniqueTag)
  const row = page.locator('tr', { hasText: uniqueTag }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
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
  let access = await page.request.get(`/api/bff/mcp/${serverId}/access`)
  expect((await access.text())).toContain(agentId)

  const rev = await page.request.post(`${BASE}/api/bff/mcp/${serverId}/revoke`, {
    data: { agent_ids: [agentId] },
  })
  expect(rev.status()).toBe(200)

  // After revoke the access list must no longer contain the agent.
  access = await page.request.get(`/api/bff/mcp/${serverId}/access`)
  const body = await access.json()
  expect(body.agents ?? []).not.toContain(agentId)
})
