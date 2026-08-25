import { useEffect, useState } from 'react'
import { svcGet, fmtInt } from '../api.js'

function useBff() {
  const [state, setState] = useState({ data: null, err: '' })
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    fetch('/api/bff/tools')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`tools: ${r.status}`))))
      .then((d) => setState({ data: d, err: '' }))
      .catch((e) => setState({ data: null, err: String(e.message || e) }))
  }, [reloadKey])
  return { ...state, reload: () => setReloadKey((k) => k + 1) }
}

function useUnifiedCatalog() {
  const [catalog, setCatalog] = useState({ data: null, err: '' })
  useEffect(() => {
    fetch('/api/bff/catalog')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => setCatalog({ data, err: '' }))
      .catch((cause) => setCatalog({ data: null, err: String(cause.message || cause) }))
  }, [])
  return catalog
}

function useSvcRelay() {
  const [s, setS] = useState({ data: null, err: '' })
  useEffect(() => {
    svcGet('relay', '/health')
      .then((d) => setS({ data: d, err: '' }))
      .catch((e) => setS({ data: null, err: String(e.message || e) }))
  }, [])
  return s
}

async function checkCatalogHealth(source, itemId, setMessage) {
  try {
    const response = await fetch(`/api/bff/catalog/${encodeURIComponent(source)}/${encodeURIComponent(itemId)}/health`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body.healthy === false) throw new Error(body.reason || `status ${response.status}`)
    setMessage({ ok: true, text: `${source}/${itemId}: ${body.status ?? 'healthy'}` })
  } catch (error) {
    setMessage({ ok: false, text: `${source}/${itemId}: ${String(error.message || error)}` })
  }
}

export default function Tools() {
  const relay = useSvcRelay()
  const bff = useBff()
  const catalog = useUnifiedCatalog()
  const [healthMessage, setHealthMessage] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [extra, setExtra] = useState([])
  const [catalogPage, setCatalogPage] = useState(0)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [invocation, setInvocation] = useState({ action: 'call', resource: 'mcp/github', definition: '', preview: null, result: null })

  const runAuthorizationPreview = async () => {
    const response = await fetch('/api/bff/access/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: invocation.action,
        resource: invocation.resource,
        requested_scopes: [],
        definition: invocation.definition,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setInvocation((current) => ({ ...current, preview: body }))
    return response.ok && body.decision === 'allow'
  }

  const invokeTool = async (event) => {
    event.preventDefault()
    setInvocation((current) => ({ ...current, result: null }))
    if (!await runAuthorizationPreview()) {
      setInvocation((current) => ({ ...current, result: { blocked: true } }))
      return
    }
    setInvocation((current) => ({ ...current, result: { accepted: true, action: current.action, resource: current.resource } }))
  }

  const tools = Array.isArray(bff.data?.tools) ? bff.data.tools : []
  const catalogItems = catalog.data?.items ?? []
  const filteredCatalog = catalogItems.filter((item) => {
    if (!catalogSearch) return true
    const q = catalogSearch.toLowerCase()
    return (
      (item.name ?? '').toLowerCase().includes(q) ||
      (item.source ?? '').toLowerCase().includes(q) ||
      (item.kind ?? '').toLowerCase().includes(q)
    )
  })
  const catalogTotalPages = Math.max(1, Math.ceil(filteredCatalog.length / CATALOG_PAGE_SIZE))
  const catalogSafePage = Math.min(catalogPage, catalogTotalPages - 1)
  const pagedCatalog = filteredCatalog.slice(catalogSafePage * CATALOG_PAGE_SIZE, (catalogSafePage + 1) * CATALOG_PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Tools &amp; MCP</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Tool calls governed by Relay; MCP servers catalogued in Hive.
        </p>
      </div>

      {bff.err && <div className="panel p-4 text-[13px] text-amber-400/90">Tools feed unavailable — {bff.err}</div>}

      <section className="panel overflow-hidden" data-testid="unified-catalog">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Unified capability catalog</span>
          <span className="num text-xs text-slate-600">{catalog.data?.total ?? 0}</span>
        </div>
        {catalog.data?.items?.length > 0 && (
          <div className="px-4 py-3 border-b border-[#232833] flex items-center gap-3">
            <input
              data-testid="catalog-search"
              placeholder="Search capabilities…"
              value={catalogSearch}
              onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(0) }}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0c10] border border-[#232833] text-[13px] text-slate-200 focus:outline-none focus:border-teal-500"
            />
            <span className="num text-xs text-slate-600">{filteredCatalog.length} results</span>
          </div>
        )}
        {catalog.err && <div className="p-4 text-sm text-amber-300">{catalog.err}</div>}
        {!catalog.err && !catalog.data && <div className="p-4 text-sm text-slate-600">Loading…</div>}
        {catalog.data && !catalog.data.items.length && (
          <div className="p-8 text-center text-sm text-slate-600" data-testid="catalog-empty">No capabilities registered.</div>
        )}
        {filteredCatalog.length > 0 && (
          <table className="data" data-testid="catalog-table">
            <thead><tr><th>Capability</th><th>Source</th><th>Kind</th><th>Status</th><th>OAuth</th><th>Health</th><th>Authorized agents</th><th>Lifecycle</th></tr></thead>
            <tbody>
              {pagedCatalog.map((item, index) => (
                <tr key={`${item.source}-${item.kind}-${item.id}-${index}`} data-testid={`catalog-${item.source}-${item.kind}`}>
                  <td className="text-slate-200">{String(item.name)}</td>
                  <td><span className="badge badge-mono !text-[10px]">{item.source}</span></td>
                  <td>{String(item.kind)}</td>
                  <td><span className={`badge ${String(item.status) === 'false' ? 'badge-warn' : 'badge-ok'}`}>{String(item.status)}</span></td>
                  <td data-testid={`catalog-oauth-${item.id}`}>
                    <span className="badge badge-mono !text-[10px]">{item.oauth?.status}</span>
                    <div className="text-[10px] text-slate-500">{(item.oauth?.scopes ?? []).join(', ') || '—'}</div>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                      data-testid={`catalog-health-${item.source}-${item.id}`}
                      onClick={() => checkCatalogHealth(item.source, String(item.id), setHealthMessage)}
                    >
                      Health
                    </button>
                  </td>
                  {item.kind === 'mcp-server' ? (
                    <td className="text-xs text-slate-400" data-testid={`catalog-agents-${item.id}`}>
                      {(item.detail?.authorized_agents ?? []).map((agent) => agent.id ?? agent.agent_id ?? agent).join(', ') || 'none'}
                    </td>
                  ) : (
                    <td>—</td>
                  )}
                  <td>
                    <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`toggle-${item.id}`} onClick={async () => {
                      const response = await fetch(`/api/bff/catalog/relay/${encodeURIComponent(String(item.id))}/toggle`, { method: 'POST' })
                      const body = await response.json().catch(() => ({}))
                      setHealthMessage({ ok: response.ok, text: response.ok ? `${item.name}: ${body.enabled ? 'enabled' : 'disabled'}` : body.error || `status ${response.status}` })
                    }}>Toggle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Catalog pagination */}
        {catalogTotalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-[#232833] flex items-center justify-between" data-testid="catalog-pagination">
            <span className="text-xs text-slate-500 num">
              Page {catalogSafePage + 1} of {catalogTotalPages} · {filteredCatalog.length} total
            </span>
            <div className="flex gap-1.5">
              <button
                className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                disabled={catalogSafePage === 0}
                onClick={() => setCatalogPage(catalogSafePage - 1)}
                data-testid="catalog-page-prev"
              >← Prev</button>
              <button
                className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                disabled={catalogSafePage >= catalogTotalPages - 1}
                onClick={() => setCatalogPage(catalogSafePage + 1)}
                data-testid="catalog-page-next"
              >Next →</button>
            </div>
          </div>
        )}
      </section>
      {healthMessage && <div className={healthMessage.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'} data-testid="catalog-health-result">{healthMessage.text}</div>}

      <section className="panel overflow-hidden" data-testid="policy-mapping">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Policy mapping status</span>
          <span className="num text-xs text-slate-600">{catalog.data?.grant_mapping_status?.missing_mappings ?? 0} missing</span>
        </div>
        {catalog.data?.items?.filter((item) => item.mapping)?.map((item) => (
          <div key={item.id} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2" data-testid={`mapping-${item.id}`}>
            <span className="text-sm text-slate-200">{item.name}</span>
            <span className={`badge ${item.mapping.state === 'mapped' ? 'badge-ok' : item.mapping.state === 'missing_policy' ? 'badge-crit' : 'badge-warn'}`}>{item.mapping.state}</span>
          </div>
        ))}
      </section>

      <form className="panel p-5 space-y-3" data-testid="tool-invocation-console" onSubmit={invokeTool}>
        <h2 className="font-semibold">Guarded tool invocation</h2>
        <p className="text-xs text-slate-500">The Hub blocks dispatch unless the advisory preview returns allow.</p>
        <input data-testid="invoke-action" value={invocation.action} onChange={(event) => setInvocation({ ...invocation, action: event.target.value })} />
        <input data-testid="invoke-resource" value={invocation.resource} onChange={(event) => setInvocation({ ...invocation, resource: event.target.value })} />
        <textarea data-testid="invoke-policy" rows="4" placeholder="YAML policy rules" value={invocation.definition} onChange={(event) => setInvocation({ ...invocation, definition: event.target.value })} />
        <button className="btn btn-primary" data-testid="invoke-run">Preview and invoke</button>
        {invocation.preview && <pre className="text-xs text-slate-300" data-testid="invoke-preview">{JSON.stringify(invocation.preview, null, 2)}</pre>}
        {invocation.result && (
          <div className="text-sm" data-testid="invoke-result">
            {invocation.result.blocked ? <span className="text-rose-400">Blocked by policy preview.</span> : <span className="text-teal-300">Authorized invocation accepted.</span>}
          </div>
        )}
      </form>

      <div className="grid xl:grid-cols-2 gap-6">
        <section className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Governed tools</span>
            <span className="num text-[11px] text-slate-600">{fmtInt(tools.length)}</span>
          </div>
          <table className="data">
            <thead><tr><th>Tool</th><th>Status</th></tr></thead>
            <tbody>
              {tools.slice(0, 15).map((t, i) => (
                <tr key={t.name ?? i}>
                  <td className="text-slate-200 font-mono text-xs">{t.name ?? JSON.stringify(t).slice(0, 40)}</td>
                  <td><span className="badge badge-ok">available</span></td>
                </tr>
              ))}
              {!tools.length && (
                <tr><td colSpan="2" className="text-center py-8 text-slate-600">
                  No tools registered yet — connect MCP servers to populate this list.
                </td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-hidden" data-testid="relay-health">
          <div className="px-4 py-3 border-b border-[#232833]">
            <span className="label">Relay gateway</span>
          </div>
          {relay.err && <div className="p-4 text-[13px] text-amber-400/90">Relay unreachable — {relay.err}</div>}
          {relay.data && (
            <div className="p-4 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-500">Status</span>
                <span className="badge badge-ok">{relay.data.status ?? 'healthy'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Backends healthy</span>
                <span className="num">{relay.data.backends?.healthy ?? 0}/{relay.data.backends?.total ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Circuits open</span>
                <span className="num">{relay.data.backends?.circuit_open ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Uptime</span>
                <span className="num">{Math.round(relay.data.uptime_seconds ?? 0)}s</span></div>
            </div>
          )}
        </section>
      </div>

      {/* MCP catalogue with registration form */}
      <section className="panel overflow-hidden" data-testid="mcp-catalogue">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">MCP servers · catalogue</span>
          <button
            className="btn btn-primary !py-1.5 !px-3 !text-xs"
            data-testid="install-mcp-btn"
            onClick={() => setWizardOpen(true)}
          >
            Install MCP server
          </button>
        </div>
        {wizardOpen && (
          <InstallWizard
            onClose={() => setWizardOpen(false)}
            onInstalled={(srv) => setExtra((x) => [...x.filter((s) => s.id !== srv.id), srv])}
          />
        )}
        <McpList extra={extra} />
      </section>
    </div>
  )
}

function McpForm({ onCreated }) {
  const [form, setForm] = useState({
    name: '', url: '', transport: 'sse', description: '',
  })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await fetch('/api/bff/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || `status ${r.status}`)
      onCreated(body)
      setMsg(null)
    } catch (e2) {
      setMsg({ ok: false, text: String(e2.message || e2) })
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#232833] text-[13px] text-slate-200 focus:outline-none focus:border-teal-500'

  return (
    <form onSubmit={submit} className="p-4 border-b border-[#232833] space-y-3 bg-[#0d1015]" data-testid="mcp-form">
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">Name</span>
          <input className={input} value={form.name} onChange={set('name')} placeholder="github-mcp" required data-testid="mcp-name" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Transport</span>
          <select className={input} value={form.transport} onChange={set('transport')} data-testid="mcp-transport">
            <option value="sse">sse</option>
            <option value="streamable-http">streamable-http</option>
            <option value="stdio">stdio</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs text-slate-500">URL</span>
          <input className={input} type="url" value={form.url} onChange={set('url')} placeholder="https://mcp.example.com/sse" required data-testid="mcp-url" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs text-slate-500">Description</span>
          <input className={input} value={form.description} onChange={set('description')} placeholder="What does this server provide?" data-testid="mcp-description" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary" data-testid="mcp-submit">
          {busy ? 'Registering…' : 'Register server'}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-teal-300' : 'text-rose-400'}`}>{msg.text}</span>}
      </div>
    </form>
  )
}

function McpList({ extra = [] }) {
  const [list, setList] = useState(null)
  const [accessFor, setAccessFor] = useState(null) // server_id being inspected
  const [access, setAccess] = useState([])
  const [busy, setBusy] = useState('')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/bff/mcp')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setList(Array.isArray(d) ? d : d.servers ?? d.items ?? []))
      .catch(() => setList([]))
  }, [extra.length])

  const all = [...extra, ...(Array.isArray(list) ? list : [])]
  const filtered = all.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (m.name ?? '').toLowerCase().includes(q) ||
      (m.url ?? '').toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q)
    )
  })
  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const grantToAgent = async (serverId) => {
    const agentId = prompt('Agent ID to grant access:')
    if (!agentId) return
    setBusy(serverId + ':grant')
    try {
      const r = await fetch(`/api/bff/mcp/${serverId}/grant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_ids: [agentId] }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || `status ${r.status}`)
      setBusy('')
      alert('Access granted.')
    } catch (e) {
      setBusy('')
      alert('Grant failed: ' + String(e.message || e))
    }
  }

  const revokeFromAgent = async (serverId) => {
    const agentId = prompt('Agent ID to revoke access from:')
    if (!agentId) return
    setBusy(serverId + ':revoke')
    try {
      const r = await fetch(`/api/bff/mcp/${serverId}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_ids: [agentId] }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || `status ${r.status}`)
      setBusy('')
      alert('Access revoked.')
    } catch (e) {
      setBusy('')
      alert('Revoke failed: ' + String(e.message || e))
    }
  }

  const showAccess = async (serverId) => {
    setBusy(serverId + ':access')
    setAccessFor(serverId)
    try {
      const r = await fetch(`/api/bff/mcp/${serverId}/access`)
      const d = await r.json()
      setAccess(Array.isArray(d) ? d : d.agents ?? d.access ?? [])
    } catch {
      setAccess([])
    } finally {
      setBusy('')
    }
  }

  if (!Array.isArray(list)) return <div className="p-4 text-sm text-slate-600">Loading catalogue…</div>
  if (!all.length)
    return (
      <div className="p-8 text-center text-[13px] text-slate-600" data-testid="mcp-empty">
        No MCP servers registered. Click “Register MCP server” to add the first one.
      </div>
    )

  return (
    <div>
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[#232833] flex items-center gap-3">
        <input
          data-testid="mcp-search"
          placeholder="Search by name, URL, or description…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="flex-1 px-3 py-1.5 rounded-lg bg-[#0a0c10] border border-[#232833] text-[13px] text-slate-200 focus:outline-none focus:border-teal-500"
        />
        <span className="num text-xs text-slate-600">{filtered.length} servers</span>
      </div>
      <table className="data" data-testid="mcp-table">
        <thead><tr><th>Name</th><th>Transport</th><th>URL</th><th>Install</th></tr></thead>
        <tbody>
          {paged.map((m, i) => (
            <tr key={m.id ?? i}>
              <td className="text-slate-200">
                {m.name}
                {m.description && <div className="text-[10px] text-slate-600">{String(m.description).slice(0, 60)}</div>}
              </td>
              <td><span className="badge badge-mono !text-[10px]">{m.transport}</span></td>
              <td className="text-slate-500 text-xs max-w-[220px] truncate">{m.url}</td>
              <td>
                <div className="flex gap-1.5">
                  <button className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                    disabled={busy === m.id + ':grant'}
                    onClick={() => grantToAgent(m.id)}
                    title="Give an agent access to this server">Grant → agent</button>
                  <button className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                    disabled={busy === m.id + ':revoke'}
                    onClick={() => revokeFromAgent(m.id)}
                    title="Remove agent access">Revoke</button>
                  <button className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                    disabled={busy === m.id + ':access'}
                    onClick={() => showAccess(m.id)}
                    title="List agents with access">Who has it?</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {accessFor && (
        <div className="p-4 border-t border-[#232833]" data-testid="access-list">
          <span className="label">Agents with access to {accessFor.slice(0, 13)}…</span>
          <pre className="mt-2 p-3 rounded-lg bg-[#0a0c10] border border-[#232833] text-[11px] text-slate-400 overflow-x-auto">
            {JSON.stringify(access, null, 1).slice(0, 800)}
          </pre>
        </div>
      )}
      {busy && <div className="p-2 text-[11px] text-slate-500 num">working: {busy}…</div>}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-[#232833] flex items-center justify-between" data-testid="mcp-pagination">
          <span className="text-xs text-slate-500 num">
            Page {safePage + 1} of {totalPages} · {filtered.length} total
          </span>
          <div className="flex gap-1.5">
            <button
              className="btn btn-ghost !py-1 !px-2 !text-[11px]"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              data-testid="mcp-page-prev"
            >← Prev</button>
            <button
              className="btn btn-ghost !py-1 !px-2 !text-[11px]"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              data-testid="mcp-page-next"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

const CATALOG_PAGE_SIZE = 20

function InstallWizard({ onClose, onInstalled }) {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState({
    name: '', url: '', transport: 'sse', description: '',
    agentIds: '',
    authType: 'none',
    oauthClientId: '',
    oauthClientSecret: '',
    oauthScopes: '',
    headers: '',
  })
  const [busy, setBusy] = useState(false)
  const [installedServer, setInstalledServer] = useState(null)
  const [authError, setAuthError] = useState('')
  const [error, setError] = useState('')

  const needsAuth = config.authType === 'oauth'
  const STEPS = needsAuth
    ? ['Configure', 'Install', 'Authenticate', 'Authorize', 'Done']
    : ['Configure', 'Install', 'Authorize', 'Done']

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length))
  const back = () => setStep((s) => Math.max(s - 1, 1))

  const doInstall = async () => {
    setBusy(true)
    setError('')
    try {
      // Step 2: Register the server
      const res = await fetch('/api/bff/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          url: config.url,
          transport: config.transport,
          description: config.description,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `status ${res.status}`)
      setInstalledServer(body)

      // PATCH auth config for OAuth servers
      if (config.authType !== 'none') {
        const patchBody = { auth_type: config.authType }
        if (config.oauthScopes) patchBody.oauth_scopes = config.oauthScopes
        if (config.oauthClientId) patchBody.oauth_client_id = config.oauthClientId
        if (config.oauthClientSecret) patchBody.oauth_client_secret = config.oauthClientSecret
        const authResponse = await fetch(`/api/bff/mcp/${body.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patchBody),
        })
        if (!authResponse.ok) throw new Error(`auth configuration failed: status ${authResponse.status}`)
      }
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const doAuthorize = async () => {
    if (!installedServer || !config.agentIds.trim()) return next()
    setBusy(true)
    try {
      const ids = config.agentIds.split(',').map((id) => id.trim()).filter(Boolean)
      const res = await fetch(`/api/bff/mcp/${installedServer.id}/grant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_ids: ids }),
      })
      if (!res.ok) throw new Error(`grant failed: status ${res.status}`)
      next()
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const startOauthConnect = async () => {
    if (!installedServer) return
    setBusy(true)
    setAuthError('')
    try {
      const res = await fetch(`/api/bff/mcp/${installedServer.id}/oauth/connect`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.detail || body.error || `status ${res.status}`)
      if (body.authorization_url) {
        window.open(body.authorization_url, '_blank', 'width=600,height=700')
        next()
      } else {
        throw new Error('No authorization URL returned')
      }
    } catch (e) {
      setAuthError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-[#232833] text-[13px] text-slate-200 focus:outline-none focus:border-teal-500'

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[8vh]" data-testid="install-wizard">
      <div className="w-full max-w-lg panel !bg-[#10131a] shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Install MCP Server</h2>
          <button className="btn btn-ghost !px-2 !text-sm" onClick={onClose}>✕</button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0" data-testid="wizard-stepper">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                step > i ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : step === i + 1 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40'
                : 'bg-slate-800 text-slate-600 border border-slate-700'
              }`}>{i + 1}</div>
              <span className={`ml-1.5 text-[11px] font-medium whitespace-nowrap ${
                step >= i + 1 ? 'text-slate-200' : 'text-slate-600'
              }`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${step > i + 1 ? 'bg-teal-500/40' : 'bg-[#232833]'}`} />}
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{error}</div>
        )}

        {/* Step 1: Configure */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Register a new MCP server endpoint for the ecosystem catalog.</p>
            <label className="block"><span className="text-xs text-slate-500">Server name</span>
              <input className={inputCls} data-testid="wiz-name" required placeholder="github-mcp" value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-slate-500">Endpoint URL</span>
              <input className={inputCls} data-testid="wiz-url" type="url" required placeholder="https://mcp.example.com/sse" value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-slate-500">Transport</span>
              <select className={inputCls} value={config.transport} onChange={(e) => setConfig({ ...config, transport: e.target.value })}>
                <option value="sse">SSE</option>
                <option value="streamable-http">Streamable HTTP</option>
                <option value="stdio">stdio</option>
              </select>
            </label>
            <label className="block"><span className="text-xs text-slate-500">Description</span>
              <input className={inputCls} placeholder="What does this server provide?" value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-slate-500">Authentication</span>
              <select className={inputCls} data-testid="wiz-auth-type" value={config.authType} onChange={(e) => setConfig({ ...config, authType: e.target.value })}>
                <option value="none">None (open access)</option>
                <option value="oauth">OAuth 2.0 (DCR / client credentials)</option>
              </select>
            </label>
            {config.authType === 'oauth' && (
              <div className="inset p-3 space-y-3 rounded-lg">
                <p className="text-[11px] text-slate-500">
                  The server will attempt Dynamic Client Registration (DCR / RFC 7591) automatically.
                  If the provider doesn't support DCR, provide pre-registered client credentials below (CIMD).
                </p>
                <label className="block"><span className="text-xs text-slate-500">Client ID (optional — leave blank for DCR)</span>
                  <input className={inputCls} data-testid="wiz-client-id" placeholder="Pre-registered client ID" value={config.oauthClientId} onChange={(e) => setConfig({ ...config, oauthClientId: e.target.value })} />
                </label>
                <label className="block"><span className="text-xs text-slate-500">Client Secret (optional)</span>
                  <input className={inputCls} type="password" data-testid="wiz-client-secret" placeholder="Pre-registered client secret" value={config.oauthClientSecret} onChange={(e) => setConfig({ ...config, oauthClientSecret: e.target.value })} />
                </label>
                <label className="block"><span className="text-xs text-slate-500">Scopes</span>
                  <input className={inputCls} data-testid="wiz-scopes" placeholder="openid read write" value={config.oauthScopes} onChange={(e) => setConfig({ ...config, oauthScopes: e.target.value })} />
                </label>
              </div>
            )}
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={!config.name || !config.url} onClick={() => { if (!config.description) config.description = config.name; next() }} data-testid="wiz-next-1">Next →</button>
            </div>
          </div>
        )}

        {/* Step 2: Install */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Ready to install. The server will be registered in the Hive catalog and made available to Relay.</p>
            <div className="inset p-3 text-xs text-slate-300 space-y-1">
              <div><span className="text-slate-500">Name:</span> {config.name}</div>
              <div><span className="text-slate-500">URL:</span> {config.url}</div>
              <div><span className="text-slate-500">Transport:</span> {config.transport}</div>
            </div>
            {!installedServer ? (
              <button className="btn btn-primary w-full" disabled={busy} onClick={doInstall} data-testid="wiz-install-btn">
                {busy ? 'Installing…' : 'Install now'}
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300" data-testid="wiz-installed-ok">
                ✓ Installed as <code className="font-mono text-xs">{installedServer.id}</code>
              </div>
            )}
            <div className="flex justify-between">
              <button className="btn btn-ghost" onClick={back}>← Back</button>
              {installedServer && <button className="btn btn-primary" onClick={next} data-testid="wiz-next-2">Next →</button>}
            </div>
          </div>
        )}

        {/* Step 3/4: Authorize */}
        {step === (needsAuth ? 4 : 3) && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Which agents should have access? You can also grant access later from this page.</p>
            <label className="block"><span className="text-xs text-slate-500">Agent IDs (comma separated)</span>
              <textarea className={inputCls} rows={3} data-testid="wiz-agents" placeholder="agt_abc123, agt_def456" value={config.agentIds} onChange={(e) => setConfig({ ...config, agentIds: e.target.value })} />
            </label>
            <div className="flex justify-between">
              <button className="btn btn-ghost" onClick={next}>Skip</button>
              <button className="btn btn-primary" disabled={busy || !config.agentIds.trim()} onClick={doAuthorize} data-testid="wiz-authorize-btn">
                {busy ? 'Authorizing…' : 'Grant access'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 (OAuth): Authenticate */}
        {step === 3 && needsAuth && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Click below to start the OAuth authorization flow. A popup will open — sign in and grant access.
              The server will use DCR if supported, or the credentials you provided.
            </p>
            {authError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">{authError}</div>}
            <button className="btn btn-primary w-full" disabled={busy} onClick={startOauthConnect} data-testid="wiz-oauth-connect-btn">
              {busy ? 'Starting OAuth…' : 'Start OAuth authorization'}
            </button>
            <div className="flex justify-between">
              <button className="btn btn-ghost" onClick={next}>Skip for now</button>
            </div>
          </div>
        )}

        {/* Final step: Done */}
        {step === (needsAuth ? 5 : 4) && (
          <div className="space-y-4 text-center py-6" data-testid="wiz-done">
            <div className="text-3xl">✅</div>
            <h3 className="text-lg font-semibold text-slate-100">Installation complete</h3>
            <p className="text-sm text-slate-400">
              <strong>{config.name}</strong> is installed and ready.
              {config.agentIds.trim() ? ' Access has been granted to the specified agents.' : ' No agents were assigned yet — use Grant on the catalog row.'}
            </p>
            <button className="btn btn-primary" data-testid="wiz-finish" onClick={() => { onInstalled(installedServer); onClose() }}>Finish</button>
          </div>
        )}
      </div>
    </div>
  )
}
