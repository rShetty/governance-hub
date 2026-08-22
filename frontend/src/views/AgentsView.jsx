import { useEffect, useState } from 'react'
import { svcGet, identities, fmtInt } from '../api.js'

/**
 * Agents — the unified roster.
 * Left: runtime agents (Hive). Right: machine identities (Argus agt_).
 * One place to see every actor in the ecosystem.
 */
export default function AgentsView() {
  const [hive, setHive] = useState({ data: null, err: '' })
  const [dir, setDir] = useState({ data: null, err: '' })

  useEffect(() => {
    svcGet('hive', '/api/agents')
      .then((d) => setHive({ data: d, err: '' }))
      .catch((e) => setHive({ data: null, err: String(e.message || e) }))
    identities()
      .then((d) => setDir({ data: d, err: '' }))
      .catch((e) => setDir({ data: null, err: String(e.message || e) }))
  }, [])

  const runtimeRaw = Array.isArray(hive.data)
    ? hive.data
    : (hive.data?.items ?? hive.data?.agents ?? [])
  const runtimeAgents = [...runtimeRaw].sort(
    (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  )
  const agents = Array.isArray(dir.data?.agents) ? dir.data.agents : []

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="h-display text-2xl">Agents</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Runtime actors (Hive) and their ecosystem identities (Argus) — one roster.
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Runtime agents — Hive */}
        <section className="panel overflow-hidden" data-testid="runtime-agents">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Runtime · Hive</span>
            <span className="num text-[11px] text-slate-600">{fmtInt(runtimeAgents.length)}</span>
          </div>
          {hive.err && <div className="p-4 text-[13px] text-amber-400/90">Hive unreachable — {hive.err}</div>}
          {!hive.err && !hive.data && <div className="p-4 text-sm text-slate-600">Loading…</div>}
          {hive.data && (
            <table className="data">
              <thead><tr><th>Agent</th><th>Status</th></tr></thead>
              <tbody>
                {runtimeAgents.slice(0, 12).map((a) => (
                  <tr key={a.id ?? a.agent_id}>
                    <td className="text-slate-200">{a.name ?? a.slug ?? a.id}</td>
                    <td><span className={`badge ${a.status === 'active' ? 'badge-ok' : 'badge-warn'}`}>{a.status ?? 'unknown'}</span></td>
                  </tr>
                ))}
                {!runtimeAgents.length && (
                  <tr><td colSpan="2" className="text-center py-8 text-slate-600">No runtime agents registered</td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        {/* Machine identities — Argus */}
        <section className="panel overflow-hidden" data-testid="machine-identities">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Identities · Argus</span>
            <span className="num text-[11px] text-slate-600">{fmtInt(agents.length)}</span>
          </div>
          {dir.err && <div className="p-4 text-[13px] text-amber-400/90">Argus directory needs admin session — {dir.err}</div>}
          {!dir.err && !dir.data && <div className="p-4 text-sm text-slate-600">Loading…</div>}
          {dir.data && (
            <table className="data">
              <thead><tr><th>Identity</th><th>Scopes</th><th>Kill switch</th></tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td className="text-slate-200 font-mono text-xs">{a.name}<div className="text-slate-600 text-[10px]">{a.owner}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(a.scopes || []).map((s) => <span key={s} className="badge badge-mono !text-[10px]">{s}</span>)}
                      </div>
                    </td>
                    <td>{a.status === 'active'
                      ? <span className="badge badge-ok">armed</span>
                      : <span className="badge badge-crit">revoked</span>}</td>
                  </tr>
                ))}
                {!agents.length && (
                  <tr><td colSpan="3" className="text-center py-8 text-slate-600">
                    No agent identities yet.<br />
                    <span className="text-slate-700 text-xs">Create via Argus POST /api/agents — P2 adds this to this view.</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
