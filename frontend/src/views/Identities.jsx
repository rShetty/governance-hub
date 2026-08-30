import { useEffect, useState } from 'react'
import { identities } from '../api'
import { usePagination, PaginationControls } from '../components.jsx'

export default function Identities() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('humans')

  useEffect(() => {
    identities()
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  const humans = Array.isArray(data?.humans) ? data.humans : []
  const agents = Array.isArray(data?.agents) ? data.agents : []
  const humanPage = usePagination(humans, 20)
  const agentPage = usePagination(agents, 20)

  if (err) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
        {err} — admin access on the IdP is required to view the directory.
      </div>
    )
  }
  if (!data) return <div className="text-slate-500 text-sm">Loading directory…</div>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h-display text-2xl">Identity Directory</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Every human and machine principal in the ecosystem, from Argus.</p>
      </div>
      <div className="flex gap-2">
        {['humans', 'agents'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === t
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {t === 'humans' ? `Humans (${humans.length})` : `Agents (${agents.length})`}
          </button>
        ))}
      </div>

      {tab === 'humans' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">GitHub</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {humanPage.pageItems.map((u) => (
                <tr key={u.id} className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200">{u.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.admin ? <span className="text-amber-300">admin</span> : <span className="text-slate-500">user</span>}
                  </td>
                  <td className="px-4 py-3">{u.github_linked ? '✓' : '—'}</td>
                  <td className="px-4 py-3">
                    {u.disabled ? (
                      <span className="text-rose-400">disabled</span>
                    ) : (
                      <span className="text-emerald-400">active</span>
                    )}
                  </td>
                </tr>
              ))}
              {!humans.length && (
                <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-600">No humans yet</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls testIdPrefix="identity-humans" page={humanPage.page} totalPages={humanPage.totalPages} total={humanPage.total} singular="human" plural="humans" onPageChange={humanPage.setPage} />
        </div>
      )}

      {tab === 'agents' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Scopes</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {agentPage.pageItems.map((a) => (
                <tr key={a.id} className="border-t border-slate-800/70">
                  <td className="px-4 py-3 text-slate-200 font-mono text-xs">{a.name}</td>
                  <td className="px-4 py-3 text-slate-400">{a.owner}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(a.scopes || []).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 text-[10px] font-mono">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'active' ? (
                      <span className="text-emerald-400">active</span>
                    ) : (
                      <span className="text-rose-400">revoked</span>
                    )}
                  </td>
                </tr>
              ))}
              {!agents.length && (
                <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-600">No agent identities yet — create one via Argus POST /api/agents</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls testIdPrefix="identity-agents" page={agentPage.page} totalPages={agentPage.totalPages} total={agentPage.total} singular="identity" plural="identities" onPageChange={agentPage.setPage} />
        </div>
      )}
    </div>
  )
}
