import { useEffect, useState } from 'react'

export default function Activity() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/bff/activity?limit=50')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => setItems(data.items ?? []))
      .catch((cause) => setError(String(cause.message || cause)))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h-display text-2xl">Activity</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Phase 3 — unified activity across all backends.</p>
      </div>
      {error && <div className="panel p-4 text-sm text-amber-300">Activity unavailable — {error}</div>}
      <div className="panel overflow-hidden" data-testid="activity-feed">
        {!items && !error && <div className="p-6 text-sm text-slate-600">Loading activity…</div>}
        {items && !items.length && <div className="p-8 text-center text-sm text-slate-600" data-testid="activity-empty">No activity recorded.</div>}
        {items?.map((item, index) => (
          <div key={index} className="px-4 py-2.5 border-b border-[#232833]/60 flex items-center gap-3">
            <span className="badge badge-mono !text-[10px]">{item.source}</span>
            <span className="text-sm text-slate-200">{String(item.kind)}</span>
            <span className="text-xs text-slate-500 truncate">{String(item.summary ?? '')}</span>
            <span className="ml-auto num text-xs text-slate-600">{String(item.ts ?? '').slice(0, 19).replace('T', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
