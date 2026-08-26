import { useEffect, useState } from 'react'
import { PaginationControls, usePagination } from '../components.jsx'

export default function MyWorkspace() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/bff/my/assignments')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then(setData)
      .catch((cause) => setError(String(cause.message || cause)))
  }, [])

  const filteredMcps = (data?.mcps ?? []).filter((mcp) =>
    String(mcp.name).toLowerCase().includes(search.toLowerCase())
  )
  const mcpPagination = usePagination(filteredMcps, 12)
  const agentPagination = usePagination(data?.agents ?? [], 12)

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
            {agentPagination.pageItems.map((agent) => (
              <div key={agent.id} className="px-4 py-3 border-t border-[#232833]/60">
                <div className="text-sm text-slate-100">{agent.name}</div>
                <span className={`badge mt-1 ${agent.status === 'active' ? 'badge-ok' : 'badge-crit'}`}>{agent.status}</span>
              </div>
            ))}
            <PaginationControls
              testIdPrefix="my-agent"
              page={agentPagination.page}
              totalPages={agentPagination.totalPages}
              total={agentPagination.total}
              singular="agent"
              plural="agents"
              onPageChange={agentPagination.setPage}
            />
          </section>
          <section className="panel overflow-hidden" data-testid="my-mcps">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#232833]">
              <span className="label">Assigned MCP servers</span>
              <input className="input max-w-64" placeholder="Search servers…" value={search} onChange={(event) => { setSearch(event.target.value); mcpPagination.reset() }} />
            </div>
            {mcpPagination.pageItems.map((mcp) => (
              <div key={mcp.id} className="px-4 py-3 border-t border-[#232833]/60 text-sm text-slate-100">{mcp.name}</div>
            ))}
            <PaginationControls
              testIdPrefix="my-mcp"
              page={mcpPagination.page}
              totalPages={mcpPagination.totalPages}
              total={mcpPagination.total}
              singular="server"
              plural="servers"
              onPageChange={mcpPagination.setPage}
            />
          </section>
        </div>
      )}
    </div>
  )
}
