# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: console.spec.js >> Agents: register an agent in Hive via API and see it in the console
- Location: tests/e2e/console.spec.js:110:1

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 401
Received array: [200, 201]
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - complementary [ref=f1e4]:
    - generic [ref=f1e10]:
      - generic [ref=f1e11]: Governance
      - generic [ref=f1e12]: Argus Console
    - button "Jump to… ⌘K" [ref=f1e13] [cursor=pointer]:
      - generic [ref=f1e14]: Jump to…
      - generic [ref=f1e15]: ⌘K
    - navigation [ref=f1e16]:
      - button "Mission Control" [ref=f1e17] [cursor=pointer]
      - button "Agents" [ref=f1e20] [cursor=pointer]
      - button "Activity" [ref=f1e23] [cursor=pointer]
      - button "Access" [ref=f1e26] [cursor=pointer]
      - button "Tools & MCP" [ref=f1e29] [cursor=pointer]
      - button "Cost & Routing" [ref=f1e32] [cursor=pointer]
      - button "Security" [ref=f1e35] [cursor=pointer]
      - button "Egress" [ref=f1e38] [cursor=pointer]
      - button "Identity Directory" [ref=f1e41] [cursor=pointer]
      - button "Service Registry" [ref=f1e44] [cursor=pointer]
    - generic [ref=f1e47]:
      - generic [ref=f1e48]:
        - generic [ref=f1e49]:
          - generic [ref=f1e50]: Rajeev
          - generic [ref=f1e51]: administrator
        - link "⏻" [ref=f1e52] [cursor=pointer]:
          - /url: /logout
      - generic [ref=f1e53]: all systems · 15s
  - main [ref=f1e55]:
    - generic [ref=f1e56]:
      - generic [ref=f1e57]: Mission Control
      - generic [ref=f1e58]: authenticated
    - generic [ref=f1e62]:
      - generic [ref=f1e63]:
        - heading "Mission Control" [level=1] [ref=f1e64]
        - paragraph [ref=f1e65]: Fleet posture across the governance stack.
      - generic [ref=f1e66]:
        - generic [ref=f1e67]:
          - generic [ref=f1e68]: Backends up
          - generic [ref=f1e69]: 6<span class="text-slate-600">/6
        - generic [ref=f1e70]:
          - generic [ref=f1e71]: Agent identities
          - generic [ref=f1e72]: —
        - generic [ref=f1e73]:
          - generic [ref=f1e74]: Spend today
          - generic [ref=f1e75]: —
        - generic [ref=f1e76]:
          - generic [ref=f1e77]: Open alerts
          - generic [ref=f1e78]: —
      - generic [ref=f1e79]:
        - generic [ref=f1e80]:
          - generic [ref=f1e81]:
            - generic [ref=f1e82]: Backend fleet
            - generic [ref=f1e83]: auto-refresh 15s
          - generic [ref=f1e84]:
            - generic [ref=f1e86]: Aegis
            - generic [ref=f1e87]: 0ms
            - generic [ref=f1e88]: up
          - generic [ref=f1e89]:
            - generic [ref=f1e91]: Hive
            - generic [ref=f1e92]: 3ms
            - generic [ref=f1e93]: up
          - generic [ref=f1e94]:
            - generic [ref=f1e96]: Miser
            - generic [ref=f1e97]: 0ms
            - generic [ref=f1e98]: up
          - generic [ref=f1e99]:
            - generic [ref=f1e101]: Patroclus
            - generic [ref=f1e102]: 0ms
            - generic [ref=f1e103]: up
          - generic [ref=f1e104]:
            - generic [ref=f1e106]: Relay
            - generic [ref=f1e107]: 4ms
            - generic [ref=f1e108]: up
          - generic [ref=f1e109]:
            - generic [ref=f1e111]: Sentiel
            - generic [ref=f1e112]: 0ms
            - generic [ref=f1e113]: up
        - generic [ref=f1e114]:
          - generic [ref=f1e115]:
            - generic [ref=f1e116]: Recent signals
            - generic [ref=f1e117]: unified feed — P3
          - generic [ref=f1e118]: Unified activity timeline lands in Phase 3.Hive delegations · Sentiel events · Aegis verdicts · Miser decisions
```

# Test source

```ts
  36  |     form: { csrf, email: EMAIL, password: PASSWORD, next },
  37  |     maxRedirects: 0,
  38  |   })
  39  |   return r
  40  | }
  41  | 
  42  | test.beforeEach(async ({ page }) => {
  43  |   if (!PASSWORD) {
  44  |     test.skip(true, 'E2E_PASSWORD not set — skipping authenticated flows')
  45  |   }
  46  | })
  47  | 
  48  | // ── 1. SSO gate ───────────────────────────────────────────────────────────────
  49  | 
  50  | test('SSO: unauthenticated visit redirects to Argus login', async ({ page }) => {
  51  |   await page.context().clearCookies()
  52  |   await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  53  |   await expect(page).toHaveURL(/id\.rajeev\.me\/login/)
  54  |   await expect(page.locator('form[action="/login"]')).toBeVisible()
  55  | })
  56  | 
  57  | test('SSO: full login roundtrip lands on Mission Control', async ({ page }) => {
  58  |   await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  59  |   await expect(page).toHaveURL(/id\.rajeev\.me\/login/)
  60  | 
  61  |   await page.fill('input[name="email"]', EMAIL)
  62  |   await page.fill('input[name="password"]', PASSWORD)
  63  |   await page.click('button[type="submit"]')
  64  | 
  65  |   // Consent may appear on first-ever authorization for this client.
  66  |   const approve = page.getByRole('button', { name: 'Approve' })
  67  |   if (await approve.isVisible({ timeout: 5000 }).catch(() => false)) {
  68  |     await approve.click()
  69  |   }
  70  | 
  71  |   await page.waitForURL(`${BASE}/**`, { timeout: 20000 })
  72  |   await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
  73  |   await expect(page.getByText('authenticated')).toBeVisible()
  74  | })
  75  | 
  76  | // ── 2. Service registry CRUD ─────────────────────────────────────────────────
  77  | 
  78  | test('Registry: create, list and remove a service', async ({ page }) => {
  79  |   const id = `e2e-${runId}`
  80  |   await login(page)
  81  |   await page.getByRole('button', { name: 'Service Registry' }).click()
  82  |   await expect(page.getByRole('heading', { name: 'Service Registry' })).toBeVisible()
  83  | 
  84  |   await page.locator('input').first().fill(id)
  85  |   await page.getByPlaceholder('Sentiel').fill(`E2E Service ${runId}`)
  86  |   await page.getByPlaceholder('http://127.0.0.1:8585').fill('http://127.0.0.1:9999')
  87  |   await page.getByPlaceholder('Observability, DLP & compliance').fill('e2e test service')
  88  |   await page.getByRole('button', { name: 'Save service' }).click()
  89  |   await expect(page.getByText(/Stored|stored/)).toBeVisible({ timeout: 10000 })
  90  | 
  91  |   // Remove it again
  92  |   await page.locator('input').first().fill(id)
  93  |   page.on('dialog', (d) => d.accept())
  94  |   await page.getByRole('button', { name: 'Remove' }).click()
  95  |   await expect(page.getByText(`Removed ${id}`)).toBeVisible({ timeout: 10000 })
  96  | })
  97  | 
  98  | // ── 3. Agent creation in Hive (via console proxy + UI where applicable) ──────
  99  | 
  100 | test('Agents: Hive roster view renders runtime agents section', async ({ page }) => {
  101 |   await login(page)
  102 |   await page.goto(BASE)
  103 |   await page.getByRole('button', { name: 'Agents', exact: true }).click()
  104 |   await expect(page.getByTestId('runtime-agents')).toBeVisible()
  105 |   await expect(page.getByTestId('machine-identities')).toBeVisible()
  106 |   // Both panels show a count badge
  107 |   await expect(page.locator('[data-testid="runtime-agents"] .num').first()).toContainText(/\d+/)
  108 | })
  109 | 
  110 | test('Agents: register an agent in Hive via API and see it in the console', async ({ request, page }) => {
  111 |   await login(page)
  112 |   // Obtain a Hive API session by logging in through the hub proxy with the
  113 |   // admin user; the console proxies /api/svc/hive/*.
  114 |   const apiCtx = await pwRequest.newContext({ baseURL: BASE })
  115 | 
  116 |   // Login to hive via proxied endpoint using Argus-issued session is not yet
  117 |   // wired (P2), so use Hive's own auth: register+login a dedicated e2e user.
  118 |   const creds = { username: `e2e_${runId}`, password: `Pw${runId}!long`, email: `e2e_${runId}@test.dev` }
  119 |   await apiCtx.post('/api/svc/hive/auth/register', { data: { ...creds, name: 'E2E' } })
  120 |   const loginResp = await apiCtx.post('/api/svc/hive/auth/login', { data: { username: creds.username, password: creds.password } })
  121 |   const hiveToken = (await loginResp.json().catch(() => ({})))?.access_token
  122 | 
  123 |   let headers = {}
  124 |   if (hiveToken) headers = { Authorization: `Bearer ${hiveToken}` }
  125 | 
  126 |   const reg = await apiCtx.post('/api/svc/hive/api/agent/register', {
  127 |     headers,
  128 |     data: {
  129 |       name: `E2E Agent ${runId}`,
  130 |       description: 'created by playwright',
  131 |       agent_type: 'external',
  132 |       endpoint_url: 'http://127.0.0.1:9/nope',
  133 |       skills: [],
  134 |     },
  135 |   })
> 136 |   expect([200, 201]).toContain(reg.status())
      |                      ^ Error: expect(received).toContain(expected) // indexOf
  137 |   const body = await reg.json().catch(() => ({}))
  138 |   const agentId = body.agent_id ?? body.id
  139 | 
  140 |   // The console Agents view should reflect the roster (count >= 1)
  141 |   await page.goto(BASE)
  142 |   await page.getByRole('button', { name: 'Agents', exact: true }).click()
  143 |   await expect(page.getByTestId('runtime-agents')).toBeVisible({ timeout: 15000 })
  144 |   if (agentId) {
  145 |     await expect(page.getByText(`E2E Agent ${runId}`)).toBeVisible({ timeout: 15000 })
  146 |   }
  147 |   await apiCtx.dispose()
  148 | })
  149 | 
  150 | // ── 4. MCP servers: create + associate with an agent ─────────────────────────
  151 | 
  152 | test('MCP: create a server, grant it to an agent', async ({ request, page }) => {
  153 |   await login(page)
  154 |   const apiCtx = await pwRequest.newContext({ baseURL: BASE })
  155 |   const creds = { username: `mcp_${runId}`, password: `Pw${runId}!long`, email: `mcp_${runId}@test.dev` }
  156 |   await apiCtx.post('/api/svc/hive/auth/register', { data: { ...creds, name: 'MCP' } })
  157 |   const loginResp = await apiCtx.post('/api/svc/hive/auth/login', { data: { username: creds.username, password: creds.password } })
  158 |   const token = (await loginResp.json().catch(() => ({})))?.access_token
  159 |   const h = token ? { Authorization: `Bearer ${token}` } : {}
  160 | 
  161 |   // Register an agent first
  162 |   const reg = await apiCtx.post('/api/svc/hive/api/agent/register', {
  163 |     headers: h,
  164 |     data: {
  165 |       name: `MCP Agent ${runId}`,
  166 |       description: 'for mcp association',
  167 |       agent_type: 'external',
  168 |       endpoint_url: 'http://127.0.0.1:9/nope',
  169 |       skills: [],
  170 |     },
  171 |   })
  172 |   expect([200, 201]).toContain(reg.status())
  173 |   const agent = await reg.json().catch(() => ({}))
  174 |   const agentId = agent.agent_id ?? agent.id
  175 | 
  176 |   // Create an MCP server
  177 |   const mcp = await apiCtx.post('/api/svc/hive/api/mcp-servers', {
  178 |     headers: h,
  179 |     data: {
  180 |       name: `e2e-mcp-${runId}`,
  181 |       url: 'https://mcp.example.test/sse',
  182 |       transport: 'sse',
  183 |       description: 'playwright-created MCP server',
  184 |     },
  185 |   })
  186 |   expect([200, 201]).toContain(mcp.status())
  187 |   const server = await mcp.json().catch(() => ({}))
  188 |   const serverId = server.id ?? server.server_id
  189 | 
  190 |   // Associate: grant the agent access to the server
  191 |   if (serverId && agentId) {
  192 |     const grant = await apiCtx.post(`/api/svc/hive/api/mcp-servers/${serverId}/grant`, {
  193 |       headers: h,
  194 |       data: { agent_ids: [agentId] },
  195 |     })
  196 |     expect([200, 201]).toContain(grant.status())
  197 |   } else {
  198 |     console.warn('MCP ids missing — grant skipped', { serverId, agentId })
  199 |   }
  200 |   await apiCtx.dispose()
  201 | })
  202 | 
  203 | // ── 5. Policies (Patroclus) ──────────────────────────────────────────────────
  204 | 
  205 | test('Policies: create a policy in Patroclus and verify listing', async ({ request }) => {
  206 |   const apiCtx = await pwRequest.newContext()
  207 |   // Patroclus admin requires its own token — read from env or skip gracefully.
  208 |   const pToken = process.env.PATROCLUS_ADMIN_TOKEN
  209 |   test.skip(!pToken, 'PATROCLUS_ADMIN_TOKEN not set')
  210 | 
  211 |   const res = await apiCtx.post('https://patroclus.rajeev.me/v1/admin/policies', {
  212 |     headers: { Authorization: `Bearer ${pToken}` },
  213 |     data: {
  214 |       name: `e2e-policy-${runId}`,
  215 |       engine: 'yaml',
  216 |       definition: 'rules:\n  - allow: true\n',
  217 |     },
  218 |   })
  219 |   expect([200, 201]).toContain(res.status())
  220 | 
  221 |   const list = await apiCtx.get('https://patroclus.rajeev.me/v1/admin/policies', {
  222 |     headers: { Authorization: `Bearer ${pToken}` },
  223 |   })
  224 |   const body = await list.text()
  225 |   expect(body).toContain(`e2e-policy-${runId}`)
  226 |   await apiCtx.dispose()
  227 | })
  228 | 
  229 | // ── 6. Argus machine identity lifecycle ──────────────────────────────────────
  230 | 
  231 | test('Argus: create an agent identity, authenticate it, revoke kill switch', async ({ request, page }) => {
  232 |   await login(page)
  233 |   // Drive Argus directly with the admin browser cookies via APIRequestContext
  234 |   // sharing storageState would be ideal; simpler: log into argus via request.
  235 |   const jar = await pwRequest.newContext({ baseURL: ARGUS })
  236 |   const lp = await jar.get(`${ARGUS}/login`)
```