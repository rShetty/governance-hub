import { useEffect, useState } from 'react'

export default function MyWorkspace() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/bff/my/assignments')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then(setData)
      .catch((cause) => setError(String(cause.message || cause)))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">My Workspace</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Only the agents and MCP resources assigned to you appear here.</p>
      </div>
      {error && <div className="panel p-4 text-sm text-amber-300">{error}</div>}
      {!data && !error && <div className="panel p-6 text-sm text-slate-600">Loading assignments…</div>}
      {data && (
        <div className="grid xl:grid-cols-2 gap-6">
          <section className="panel overflow-hidden" data-testid="my-agents">
            <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Assigned agents</span></div>
            {data.agents.map((agent) => (
              <div key={agent.id} className="px-4 py-3 border-t border-[#232833]/60">
                <div className="text-sm text-slate-100">{agent.name}</div>
                <span className={`badge mt-1 ${agent.status === 'active' ? 'badge-ok' : 'badge-crit'}`}>{agent.status}</span>
              </div>
            ))}
          </section>
          <section className="panel overflow-hidden" data-testid="my-mcps">
            <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Assigned MCP servers</span></div>
            {data.mcps.map((mcp) => (
              <div key={mcp.id} className="px-4 py-3 border-t border-[#232833]/60 text-sm text-slate-100">{mcp.name}</div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
