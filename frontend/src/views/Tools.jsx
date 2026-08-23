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
  const [showForm, setShowForm] = useState(false)
  const [extra, setExtra] = useState([])

  const tools = Array.isArray(bff.data?.tools) ? bff.data.tools : []

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
        {catalog.err && <div className="p-4 text-sm text-amber-300">{catalog.err}</div>}
        {!catalog.err && !catalog.data && <div className="p-4 text-sm text-slate-600">Loading…</div>}
        {catalog.data && !catalog.data.items.length && (
          <div className="p-8 text-center text-sm text-slate-600" data-testid="catalog-empty">No capabilities registered.</div>
        )}
        {catalog.data?.items?.length > 0 && (
          <table className="data" data-testid="catalog-table">
            <thead><tr><th>Capability</th><th>Source</th><th>Kind</th><th>Status</th><th>Health</th><th>Authorized agents</th><th>Lifecycle</th></tr></thead>
            <tbody>
              {catalog.data.items.map((item, index) => (
                <tr key={`${item.source}-${item.kind}-${item.id}-${index}`} data-testid={`catalog-${item.source}-${item.kind}`}>
                  <td className="text-slate-200">{String(item.name)}</td>
                  <td><span className="badge badge-mono !text-[10px]">{item.source}</span></td>
                  <td>{String(item.kind)}</td>
                  <td><span className={`badge ${String(item.status) === 'false' ? 'badge-warn' : 'badge-ok'}`}>{String(item.status)}</span></td>
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
      </section>
      {healthMessage && <div className={healthMessage.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'} data-testid="catalog-health-result">{healthMessage.text}</div>}

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
            data-testid="toggle-mcp-form"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancel' : '+ Register MCP server'}
          </button>
        </div>
        {showForm && (
          <McpForm
            onCreated={(srv) => {
              setShowForm(false)
              setExtra((x) => [...x, srv])
            }}
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

  useEffect(() => {
    fetch('/api/bff/mcp')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setList(Array.isArray(d) ? d : d.servers ?? d.items ?? []))
      .catch(() => setList([]))
  }, [extra.length])

  const all = [...extra, ...(Array.isArray(list) ? list : [])]

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
      <table className="data" data-testid="mcp-table">
        <thead><tr><th>Name</th><th>Transport</th><th>URL</th><th>Install</th></tr></thead>
        <tbody>
          {all.map((m, i) => (
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
    </div>
  )
}
