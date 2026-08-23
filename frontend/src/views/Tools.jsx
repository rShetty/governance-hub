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

function useSvcRelay() {
  const [s, setS] = useState({ data: null, err: '' })
  useEffect(() => {
    svcGet('relay', '/health')
      .then((d) => setS({ data: d, err: '' }))
      .catch((e) => setS({ data: null, err: String(e.message || e) }))
  }, [])
  return s
}

export default function Tools() {
  const relay = useSvcRelay()
  const bff = useBff()
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

  useEffect(() => {
    fetch('/api/bff/mcp')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setList(Array.isArray(d) ? d : d.servers ?? d.items ?? []))
      .catch(() => setList([]))
  }, [extra.length])

  const all = [...extra, ...(Array.isArray(list) ? list : [])]

  if (!Array.isArray(list)) return <div className="p-4 text-sm text-slate-600">Loading catalogue…</div>
  if (!all.length)
    return (
      <div className="p-8 text-center text-[13px] text-slate-600" data-testid="mcp-empty">
        No MCP servers registered. Click “Register MCP server” to add the first one.
      </div>
    )
  return (
    <table className="data" data-testid="mcp-table">
      <thead><tr><th>Name</th><th>Transport</th><th>URL</th><th>Description</th></tr></thead>
      <tbody>
        {all.map((m, i) => (
          <tr key={m.id ?? i}>
            <td className="text-slate-200">{m.name}</td>
            <td><span className="badge badge-mono !text-[10px]">{m.transport}</span></td>
            <td className="text-slate-500 text-xs">{m.url}</td>
            <td className="text-slate-500 text-xs">{m.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
