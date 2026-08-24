import { useEffect, useState } from 'react'

export default function Activity() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ source: '', actor: '', session_id: '', resource: '', severity: '' })
  const [trace, setTrace] = useState(null)
  const [total, setTotal] = useState(0)

  const loadTrace = async (sessionId) => {
    if (!sessionId.trim()) return setTrace(null)
    try {
      const response = await fetch(`/api/bff/trace/${encodeURIComponent(sessionId)}`)
      if (!response.ok) throw new Error(`status ${response.status}`)
      setTrace(await response.json())
    } catch (cause) {
      setTrace({ error: String(cause.message || cause) })
    }
  }

  useEffect(() => {
    const query = new URLSearchParams({ limit: '50', ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) })
    fetch(`/api/bff/activity?${query}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => {
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
      })
      .catch((cause) => setError(String(cause.message || cause)))
  }, [filters])

  const exportEvidence = () => {
    const blob = new Blob([JSON.stringify({ schema: 'governance.activity.v1', filters, total, items }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-evidence-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h-display text-2xl">Activity</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Phase 3 — unified activity across all backends.</p>
      </div>
      {error && <div className="panel p-4 text-sm text-amber-300">Activity unavailable — {error}</div>}
      <div className="panel overflow-hidden" data-testid="activity-feed">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Unified activity · governance.event.v1</span>
          <span className="num text-xs text-slate-600">{total} matched</span>
        </div>
        <div className="p-4 grid md:grid-cols-5 gap-2 border-b border-[#232833]">
          {['source', 'actor', 'session_id', 'resource', 'severity'].map((field) => (
            <input key={field} data-testid={`activity-filter-${field}`} placeholder={field.replace('_', ' ')} value={filters[field]} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })} onBlur={() => field === 'session_id' && loadTrace(filters.session_id)} onKeyDown={(event) => event.key === 'Enter' && field === 'session_id' && loadTrace(filters.session_id)} />
          ))}
        </div>
        {!items && !error && <div className="p-6 text-sm text-slate-600">Loading activity…</div>}
        {items && !items.length && <div className="p-8 text-center text-sm text-slate-600" data-testid="activity-empty">No activity recorded.</div>}
        {items?.map((item, index) => (
          <div key={index} className="px-4 py-2.5 border-b border-[#232833]/60 flex items-center gap-3">
            <span className="badge badge-mono !text-[10px]">{item.source}</span>
            <span className="text-sm text-slate-200">{String(item.kind)}</span>
            <span className={`badge ${item.severity === 'critical' ? 'badge-crit' : item.severity === 'high' ? 'badge-warn' : 'badge-mono'}`}>{String(item.severity)}</span>
            <span className="text-xs text-slate-500 truncate">{String(item.summary ?? '')}</span>
            <span className="ml-auto num text-xs text-slate-600">{String(item.ts ?? '').slice(0, 19).replace('T', ' ')}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" data-testid="export-activity" onClick={exportEvidence}>Export evidence</button>
      {trace && (
        <section className="panel p-4" data-testid="trace-detail">
          {trace.error ? <p className="text-sm text-rose-400">{trace.error}</p> : (
            <>
              <h2 className="font-semibold">Trace · {trace.session_id}</h2>
              <pre className="mt-2 text-xs font-mono text-slate-300 whitespace-pre-wrap">{JSON.stringify(trace.events, null, 2)}</pre>
            </>
          )}
        </section>
      )}
    </div>
  )
}
