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
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    svcGet('hive', '/api/agents?limit=100&order=recent')
      .then((d) => setHive({ data: d, err: '' }))
      .catch((e) => setHive({ data: null, err: String(e.message || e) }))
    identities()
      .then((d) => setDir({ data: d, err: '' }))
      .catch((e) => setDir({ data: null, err: String(e.message || e) }))
  }, [])

  const runIdentityAction = async (identityId, action) => {
    const reason = window.prompt(`${action} identity ${identityId}. Required reason:`)
    if (!reason?.trim()) return
    setActionError('')
    try {
      const response = await fetch(`/api/bff/identities/${encodeURIComponent(identityId)}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      setDir((current) => ({
        ...current,
        data: {
          ...current.data,
          agents: current.data.agents.map((agent) => (
            agent.id === identityId ? { ...agent, status: body.status } : agent
          )),
        },
      }))
    } catch (error) {
      setActionError(String(error.message || error))
    }
  }

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
                  <tr key={a.id} data-testid={`identity-${a.id}`}>
                    <td className="text-slate-200 font-mono text-xs">{a.name}<div className="text-slate-600 text-[10px]">{a.owner}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(a.scopes || []).map((s) => <span key={s} className="badge badge-mono !text-[10px]">{s}</span>)}
                      </div>
                    </td>
                    <td>{a.status === 'active'
                      ? <span className="badge badge-ok">armed</span>
                      : <span className="badge badge-crit">revoked</span>}</td>
                    <td>
                      {a.status === 'active' ? (
                        <button data-testid={`identity-revoke-${a.id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => runIdentityAction(a.id, 'revoke')}>Revoke</button>
                      ) : (
                        <button data-testid={`identity-restore-${a.id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => runIdentityAction(a.id, 'restore')}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!agents.length && (
                  <tr><td colSpan="4" className="text-center py-8 text-slate-600">
                    No agent identities yet.<br />
                    <span className="text-slate-700 text-xs">Create via Argus POST /api/agents — P2 adds this to this view.</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
      {actionError && <div className="panel p-4 text-sm text-rose-400">{actionError}</div>}
    </div>
  )
}
