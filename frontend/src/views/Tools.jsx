import { useEffect, useState } from 'react'
import { svcGet, fmtInt } from '../api.js'

function useBff() {
  const [state, setState] = useState({ data: null, err: '' })
  useEffect(() => {
    fetch('/api/bff/tools')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`tools: ${r.status}`))))
      .then((d) => setState({ data: d, err: '' }))
      .catch((e) => setState({ data: null, err: String(e.message || e) }))
  }, [])
  return state
}

export default function Tools() {
  const relay = useSvcRelay()
  const bff = useBff()

  const tools = Array.isArray(bff.data?.tools) ? bff.data.tools : []
  const connectors = Array.isArray(bff.data?.connectors) ? bff.data.connectors : []

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

      {/* Hive MCP server catalogue */}
      <section className="panel overflow-hidden" data-testid="mcp-catalogue">
        <div className="px-4 py-3 border-b border-[#232833]">
          <span className="label">MCP servers · Hive catalogue</span>
        </div>
        <McpList />
      </section>
    </div>
  )
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

function McpList() {
  const [list, setList] = useState(null)
  useEffect(() => {
    fetch('/api/bff/mcp')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setList(Array.isArray(d) ? d : d.servers ?? d.items ?? []))
      .catch(() => setList([]))
  }, [])
  if (!Array.isArray(list)) return <div className="p-4 text-sm text-slate-600">Loading…</div>
  if (!list.length)
    return (
      <div className="p-8 text-center text-[13px] text-slate-600">
        No MCP servers registered. Register one against an agent from the Agents view.
      </div>
    )
  return (
    <table className="data">
      <thead><tr><th>Name</th><th>Transport</th><th>URL</th></tr></thead>
      <tbody>
        {list.map((m) => (
          <tr key={m.id}>
            <td className="text-slate-200">{m.name}</td>
            <td><span className="badge badge-mono !text-[10px]">{m.transport}</span></td>
            <td className="text-slate-500 text-xs">{m.url}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
