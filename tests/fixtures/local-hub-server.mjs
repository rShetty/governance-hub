import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const root = new URL('../../frontend/dist', import.meta.url).pathname
const packages = []
const publishers = []
const identities = [
  { id: 'agt_e2e_001', name: 'Fixture Agent', owner: 'e2e@governance.test', scopes: ['relay:call'], status: 'active' },
]
const approvals = [{ id: 'apr_e2e_001', agent_id: 'agt_e2e_001', action: 'deploy' }]
const sessions = [{ id: 'ses_e2e_001', agent_id: 'agt_e2e_001', active: true }]
const miserKeys = [{ id: 'key_e2e_001', owner: 'fixture-agent', allowed_tiers: [], active: true }]
const runtimeAgents = []
const mcpServers = [
  { id: 'server-e2e', name: 'Fixture MCP server', transport: 'sse', url: 'https://mcp.example.test/sse', description: '', authorized_agents: ['agt_e2e_001'] },
]
const policies = [{ id: 'pol_e2e_001', name: 'allow-github', engine: 'yaml', status: 'active', definition: '- name: allow-github\n  decision: allow' }]
const services = []
for (let index = 0; index < 60; index++) {
  mcpServers.push({
    id: `registry-${index}`,
    name: index === 0 ? 'inference.sh' : `registry-server-${index}`,
    transport: 'sse',
    url: `https://registry.example.test/${index}/sse`,
    description: '',
    authorized_agents: [],
  })
}

function send(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'content-type': type })
  response.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const path = url.pathname

  if (path === '/api/me') {
    const isMember = String(request.headers.cookie || '').includes('e2e_member=1')
    const loggedOut = String(request.headers.cookie || '').includes('e2e_logged_out=1')
    if (loggedOut) return send(response, 401, { error: 'login required' })
    return send(response, 200, {
      sub: 'usr_local_e2e',
      email: 'e2e@governance.test',
      name: 'Local E2E Admin',
      is_admin: !isMember,
    })
  }

  if (path === '/api/services') {
    return send(response, 200, {
      services,
      healthy_count: services.length,
    })
  }

  if (path === '/api/console/services' && request.method === 'GET') {
    return send(response, 200, services)
  }

  if (path === '/api/console/services' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      services.push({ healthy: true, latency_ms: 4, ...body })
      send(response, 201, { status: 'stored', service: body.id })
    })
    return
  }

  if (path.match(/^\/api\/console\/services\/([^/]+)$/) && request.method === 'DELETE') {
    const id = decodeURIComponent(path.split('/').at(-1))
    const index = services.findIndex(item => item.id === id)
    if (index >= 0) services.splice(index, 1)
    return send(response, index >= 0 ? 200 : 404, { status: 'removed', service: id })
  }

  if (path === '/__test__/admin') {
    response.writeHead(200, { 'set-cookie': ['e2e_member=; Path=/; Max-Age=0', 'e2e_logged_out=; Path=/; Max-Age=0'].join(', ') })
    response.end(JSON.stringify({ role: 'admin' }))
    return
  }

  if (path === '/__test__/logout') {
    response.writeHead(200, { 'set-cookie': 'e2e_logged_out=1; Path=/; Max-Age=3600' })
    response.end(JSON.stringify({ loggedOut: true }))
    return
  }

  if (path === '/api/bff/agents' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const agentId = `agent_${crypto.randomUUID().slice(0, 8)}`
      runtimeAgents.push({ agent_id: agentId, name: body.name, status: 'active', created_at: new Date().toISOString() })
      identities.push({ id: `agt_${crypto.randomUUID().slice(0, 8)}`, name: body.name, owner: 'e2e@governance.test', scopes: body.scopes ?? [], status: 'active' })
      send(response, 200, { argus: { agent_id: identities.at(-1).id }, hive: { agent_id: agentId } })
    })
    return
  }

  if (path === '/api/console/identities') {
    return send(response, 200, { humans: [], agents: identities })
  }

  if (path === '/api/bff/mcp' && request.method === 'GET') {
    return send(response, 200, mcpServers)
  }

  if (path === '/api/bff/mcp' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const server = { id: `server_${crypto.randomUUID().slice(0, 8)}`, authorized_agents: [], ...body }
      mcpServers.push(server)
      send(response, 201, server)
    })
    return
  }

  if (path.match(/^\/api\/bff\/mcp\/([^/]+)\/grant$/) && request.method === 'POST') {
    const serverId = path.split('/')[4]
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const server = mcpServers.find(item => item.id === serverId)
      if (!server) return send(response, 404, { error: 'server not found' })
      for (const agentId of body.agent_ids ?? []) {
        if (!server.authorized_agents.includes(agentId)) server.authorized_agents.push(agentId)
      }
      send(response, 200, { granted: body.agent_ids ?? [] })
    })
    return
  }

  if (path.match(/^\/api\/bff\/mcp\/([^/]+)\/revoke$/) && request.method === 'POST') {
    const serverId = path.split('/')[4]
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const server = mcpServers.find(item => item.id === serverId)
      if (!server) return send(response, 404, { error: 'server not found' })
      for (const agentId of body.agent_ids ?? []) {
        server.authorized_agents = server.authorized_agents.filter(id => id !== agentId)
      }
      send(response, 200, { revoked: body.agent_ids ?? [] })
    })
    return
  }

  if (path.match(/^\/api\/bff\/mcp\/([^/]+)\/access$/) && request.method === 'GET') {
    const serverId = path.split('/')[4]
    const server = mcpServers.find(item => item.id === serverId)
    return send(response, 200, { agents: server?.authorized_agents ?? [] })
  }

  if (path === '/api/bff/policies' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const policy = { id: `pol_${crypto.randomUUID().slice(0, 8)}`, status: 'active', ...body }
      policies.push(policy)
      send(response, 201, policy)
    })
    return
  }

  if (path === '/api/svc/hive/api/agents') {
    return send(response, 200, runtimeAgents)
  }

  if (path.match(/^\/api\/bff\/identities\/([^/]+)\/action$/) && request.method === 'POST') {
    const identityId = decodeURIComponent(path.split('/')[4])
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const identity = identities.find(item => item.id === identityId)
      if (!identity) return send(response, 404, { error: 'identity not found' })
      if (!['revoke', 'restore'].includes(body.action)) return send(response, 400, { error: 'invalid action' })
      if (!body.reason?.trim()) return send(response, 400, { error: 'reason required' })
      identity.status = body.action === 'revoke' ? 'revoked' : 'active'
      send(response, 200, { identity_id: identityId, status: identity.status, operator: 'e2e@governance.test', backend: 'argus' })
    })
    return
  }

  if (path === '/api/svc/patroclus/v1/principal/approvals') {
    return send(response, 200, approvals)
  }

  if (path === '/api/svc/patroclus/v1/sessions') {
    return send(response, 200, { sessions })
  }

  if (path === '/api/bff/access/sessions/ses_e2e_001' && request.method === 'GET') {
    return send(response, 200, {
      session_id: 'ses_e2e_001',
      agent_id: 'agt_e2e_001',
      actions_count: 7,
      spend_total: 0.25,
      trust_level: 0.95,
      killed: false,
      trajectory_length: 7,
    })
  }

  if (path === '/api/bff/access/approvals/apr_e2e_001/resolve' && request.method === 'POST') {
    approvals.length = 0
    return send(response, 200, { decision: 'approved', operator: 'e2e@governance.test' })
  }

  if (path === '/api/bff/access/sessions/ses_e2e_001' && request.method === 'GET') {
    return send(response, 200, {
      session_id: 'ses_e2e_001',
      agent_id: 'agt_e2e_001',
      actions_count: 7,
      spend_total: 0.25,
      trust_level: 0.95,
      killed: false,
      trajectory_length: 7,
    })
  }

  if (path === '/api/bff/access/sessions/ses_e2e_001/kill' && request.method === 'POST') {
    sessions.length = 0
    return send(response, 200, { result: { killed: true } })
  }

  if (path === '/api/bff/agents/00000000-0000-0000-0000-000000000009/emergency-kill' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => send(response, 200, JSON.parse(raw || '{}')))
    return
  }

  if (path === '/api/bff/access/tokens/token-e2e-jti/revoke' && request.method === 'POST') {
    return send(response, 200, { revoked: 'token-e2e-jti' })
  }

  if (path === '/api/svc/forge/api/packages' && request.method === 'GET') {
    return send(response, 200, packages)
  }

  if (path === '/api/bff/activity') {
    const source = new URL(request.url, 'http://localhost').searchParams.get('source')
    return send(response, 200, {
      items: [
        { source: 'patroclus', kind: 'policy.evaluate', summary: 'mcp/github', ts: new Date().toISOString() },
        { source: 'miser', kind: 'key.active', summary: 'playwright-agent', ts: new Date().toISOString() },
        { source: 'hive', kind: 'agent.registered', summary: 'fixture-agent', ts: new Date().toISOString() },
        { source: 'sentiel', kind: 'dlp.violation', summary: 'API key pattern', ts: new Date().toISOString() },
        { source: 'aegis', kind: 'egress.block', summary: 'evil.example.test', ts: new Date().toISOString() },
      ].filter(item => !source || item.source === source),
    })
  }

  if (path === '/api/bff/trace/session-e2e') {
    return send(response, 200, {
      session_id: 'session-e2e',
      events: [
        { source: 'patroclus', ts: '2026-01-01T00:00:00Z', detail: { action: 'policy.evaluate' } },
        { source: 'aegis', ts: '2026-01-01T00:00:01Z', detail: { action: 'egress.allowed' } },
      ],
    })
  }

  if (path === '/api/bff/access/delegations' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => send(response, 200, { grant_id: 'grant_e2e_001', scopes: JSON.parse(raw || '{}').scopes ?? [], token_delivery: 'backend-issued, not displayed' }))
    return
  }

  if (path === '/api/bff/access/grants/grant_e2e_001/revoke' && request.method === 'POST') {
    return send(response, 200, { result: { count: 1 } })
  }

  if (path === '/api/bff/cost') {
    return send(response, 200, { configured: true, keys: miserKeys })
  }

  if (path === '/api/svc/sentiel/api/alerts') {
    return send(response, 200, [{ id: 'alert_e2e_001', title: 'Spending spike detected' }])
  }

  if (path === '/api/svc/sentiel/api/integrity') {
    return send(response, 200, { intact: true, total_events: 42 })
  }

  if (path === '/api/svc/sentiel/api/alerts/alert_e2e_001/acknowledge' && request.method === 'POST') {
    return send(response, 200, { acknowledged: 'alert_e2e_001' })
  }

  if (path === '/api/svc/aegis/api/attestation/verify' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      send(response, 200, { agent_id: body.agent_id, verified: body.process_hash === 'valid-hash' })
    })
    return
  }

  if (path === '/api/svc/aegis/api/geo/check' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      send(response, 200, { allowed: !body.destination.includes('.blocked'), destination: body.destination })
    })
    return
  }

  if (path === '/api/bff/catalog') {
    return send(response, 200, {
      total: 2,
      items: [
        {
          source: 'relay',
          kind: 'connector',
          id: 'github',
          name: 'GitHub connector',
          status: true,
          oauth: { status: 'connected', scopes: ['repo', 'read:user'] },
        },
        {
          source: 'hive',
          kind: 'mcp-server',
          id: 'server-e2e',
          name: 'Fixture MCP server',
          status: 'active',
          detail: { authorized_agents: [{ id: 'agt_e2e_001' }] },
          mapping: { authorized_agent_count: 1, has_policy_mapping: true, state: 'mapped' },
          oauth: { status: 'not_applicable', scopes: [] },
        },
      ],
    })
  }

  if (path === '/api/bff/my/assignments') {
    return send(response, 200, {
      agents: [{ id: 'agt_e2e_001', name: 'Fixture Agent', status: identities[0].status }],
      mcps: [{ id: 'server-e2e', name: 'Fixture MCP server', status: 'active' }],
    })
  }

  if (path === '/__test__/member') {
    response.writeHead(200, {
      'content-type': 'application/json',
      'set-cookie': 'e2e_member=1; Path=/; Max-Age=3600',
    })
    response.end(JSON.stringify({ memberMode: true }))
    return
  }

  if (path.match(/^\/api\/svc\/sentiel\/api\/compliance\/(soc2|gdpr|eu_ai_act|hipaa)$/) && request.method === 'GET') {
    return send(response, 200, { framework: path.split('/').at(-1), controls: [{ id: `${path.split('/').at(-1)}-cc1`, status: 'evidence-complete' }] })
  }

  if (path === '/api/bff/access/simulate' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      send(response, 200, {
        decision: body.action === 'call' && body.resource === 'mcp/github' ? 'allow' : 'deny',
        matched_rule: body.resource === 'mcp/github' ? 'allow-github' : null,
        advisory: true,
      })
    })
    return
  }

  if (path === '/api/bff/identities/mint' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const identity = {
        id: `agt_${crypto.randomUUID().slice(0, 8)}`,
        name: body.name,
        owner: 'e2e@governance.test',
        scopes: body.scopes ?? [],
        status: 'active',
      }
      identities.push(identity)
      send(response, 200, { agent_id: identity.id, secret_delivery: 'secure operator channel', operator: 'e2e@governance.test' })
    })
    return
  }

  if (path === '/api/bff/runtime-agents' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const agent = { agent_id: `agent_${crypto.randomUUID().slice(0, 8)}`, status: 'active', ...body }
      runtimeAgents.push(agent)
      send(response, 201, agent)
    })
    return
  }

  if (path === '/api/bff/runtime-agents/agent_e2e_001/health' && request.method === 'GET') {
    return send(response, 200, { status: 'healthy' })
  }

  if (path === '/api/bff/cost/keys/key_e2e_001' && request.method === 'PATCH') {
    return send(response, 200, { id: 'key_e2e_001', updated: true })
  }

  if (path === '/api/bff/catalog/relay/github/health' && request.method === 'POST') {
    return send(response, 200, { source: 'relay', id: 'github', status: 'connected', healthy: true })
  }

  if (path === '/api/bff/catalog/relay/github/toggle' && request.method === 'POST') {
    return send(response, 200, { backend_id: 'github', enabled: false })
  }

  if (path === '/api/bff/access/resources' && request.method === 'GET') {
    return send(response, 200, [{ id: 'res_e2e_001', name: 'Fixture API' }])
  }

  if (path === '/api/bff/policies' && request.method === 'GET') {
    return send(response, 200, {
      policies,
    })
  }

  if (path === '/api/bff/access/resources' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => send(response, 200, JSON.parse(raw || '{}')))
    return
  }

  if (path === '/api/bff/access/simulate2' && request.method === 'POST') {
    return send(response, 200, { decision: 'deny' })
  }

  if (path === '/api/bff/cost/keys' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      const key = { id: `key_${crypto.randomUUID().slice(0, 8)}`, owner: body.owner, allowed_tiers: body.allowed_tiers ?? [], active: true }
      miserKeys.push(key)
      send(response, 200, { id: key.id, secret_delivery: 'operator-only command output', created_by: body.owner })
    })
    return
  }

  if (path === '/api/bff/cost/keys/key_e2e_001/revoke' && request.method === 'POST') {
    miserKeys[0].active = false
    return send(response, 200, { id: 'key_e2e_001', active: false })
  }

  if (path === '/api/svc/forge/api/packages' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      packages.push({
        id: crypto.randomUUID(),
        name: body.name,
        version: body.version,
        publisher: body.publisher,
        signature: null,
        factors: null,
      })
      send(response, 200, packages.at(-1))
    })
    return
  }

  if (path === '/api/svc/forge/api/keys/generate' && request.method === 'POST') {
    return send(response, 200, { public_key: 'fixture-public-key', private_key: 'fixture-private-key' })
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/[^/]+\/sign$/) && request.method === 'POST') {
    packages.forEach(pkg => { pkg.signature = 'fixture-signature'; pkg.signed = true })
    return send(response, 200, { signed: true })
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/[^/]+\/verify$/) && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      send(response, 200, { signature_valid: body.public_key === 'fixture-public-key' })
    })
    return
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/([^/]+)\/trust$/) && request.method === 'GET') {
    const packageId = path.split('/').at(-2)
    const pkg = packages.find(item => item.id === packageId) ?? packages.at(-1)
    return send(response, 200, {
      trust_score: pkg?.signature ? (pkg.name.includes('blocked') ? 0.2 : 0.95) : 0.2,
      meets_threshold: !!pkg?.signature && !pkg.name.includes('blocked'),
      has_critical: !pkg?.signature && pkg?.name?.includes('blocked'),
      factors: {
        signed: !!pkg?.signature,
        publisher_trusted: true,
        sbom_present: true,
        provenance_verified: true,
        has_critical: !pkg?.signature && pkg?.name?.includes('blocked'),
      },
    })
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/[^/]+\/(sbom|provenance)$/) && request.method === 'POST') {
    return send(response, 200, { ok: true })
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/[^/]+\/scan$/) && request.method === 'POST') {
    return send(response, 200, { vulnerabilities: {}, has_critical: false })
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/[^/]+\/agents$/) && request.method === 'GET') {
    return send(response, 200, [{ agent_id: 'agent_e2e_001', associated_by: 'governance-hub-operator' }])
  }

  if (path.match(/^\/api\/svc\/forge\/api\/packages\/[^/]+\/agents$/) && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      send(response, 200, { associated: true, agent_id: body.agent_id })
    })
    return
  }

  if (path === '/api/svc/forge/api/publishers' && request.method === 'GET') {
    return send(response, 200, publishers)
  }

  if (path === '/api/svc/forge/api/publishers' && request.method === 'POST') {
    let raw = ''
    request.on('data', chunk => { raw += chunk })
    request.on('end', () => {
      const body = JSON.parse(raw || '{}')
      publishers.push({ publisher: body.publisher, trust_level: body.trust_level ?? 1 })
      send(response, 200, { added: true })
    })
    return
  }

  if (!request.method || request.method !== 'GET' || path.startsWith('/api/')) {
    return send(response, 404, { error: 'fixture endpoint not implemented' })
  }

  const requested = normalize(path).replace(/^([/\\])+/, '')
  const target = join(root, requested || 'index.html')
  if (!target.startsWith(root)) return send(response, 403, 'forbidden', 'text/plain')
  try {
    const type = extname(target) === '.js' ? 'text/javascript'
      : extname(target) === '.css' ? 'text/css'
      : extname(target) === '.html' ? 'text/html'
      : 'application/octet-stream'
    response.writeHead(200, { 'content-type': type })
    response.end(await readFile(target))
  } catch {
    try {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(await readFile(join(root, 'index.html')))
    } catch {
      send(response, 404, 'build frontend/dist first', 'text/plain')
    }
  }
})

server.listen(18600, '127.0.0.1')
