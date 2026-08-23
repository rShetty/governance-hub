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

function send(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'content-type': type })
  response.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const path = url.pathname

  if (path === '/api/me') {
    return send(response, 200, {
      sub: 'usr_local_e2e',
      email: 'e2e@governance.test',
      name: 'Local E2E Admin',
      is_admin: true,
    })
  }

  if (path === '/api/services') {
    return send(response, 200, { services: [], healthy_count: 0 })
  }

  if (path === '/api/console/identities') {
    return send(response, 200, { humans: [], agents: identities })
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

  if (path === '/api/bff/access/approvals/apr_e2e_001/resolve' && request.method === 'POST') {
    approvals.length = 0
    return send(response, 200, { decision: 'approved', operator: 'e2e@governance.test' })
  }

  if (path === '/api/bff/access/sessions/ses_e2e_001/kill' && request.method === 'POST') {
    sessions.length = 0
    return send(response, 200, { result: { killed: true } })
  }

  if (path === '/api/svc/forge/api/packages' && request.method === 'GET') {
    return send(response, 200, packages)
  }

  if (path === '/api/bff/activity') {
    return send(response, 200, {
      items: [
        { source: 'sentiel', kind: 'dlp.violation', summary: 'API key pattern', ts: new Date().toISOString() },
        { source: 'aegis', kind: 'egress.block', summary: 'evil.example.test', ts: new Date().toISOString() },
      ],
    })
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
      })
      send(response, 200, packages.at(-1))
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
