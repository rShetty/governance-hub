import { useEffect, useState } from 'react'

export default function Cost() {
  const [state, setState] = useState({ data: null, err: '' })
  useEffect(() => {
    fetch('/api/bff/cost')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setState({ data: d, err: '' }))
      .catch((e) => setState({ data: null, err: String(e.message || e) }))
  }, [])

  const keys = Array.isArray(state.data?.keys) ? state.data.keys : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Cost &amp; Routing</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Miser gateway — tier routing, budgets and API keys per principal.
        </p>
      </div>
      {state.err && <div className="panel p-4 text-[13px] text-amber-400/90">Miser unavailable — {state.err}</div>}
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Provisioned keys</span>
          <span className="num text-[11px] text-slate-600">{keys.length}</span>
        </div>
        <table className="data">
          <thead><tr><th>Key</th><th>Owner</th><th>Tier</th><th>Status</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id ?? k.key_id}>
                <td className="text-slate-200 font-mono text-xs">{k.name ?? k.key_id}</td>
                <td className="text-slate-500">{k.owner ?? '—'}</td>
                <td><span className="badge badge-mono !text-[10px]">{k.tier ?? 'standard'}</span></td>
                <td><span className="badge badge-ok">active</span></td>
              </tr>
            ))}
            {!keys.length && !state.err && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-600">
                No API keys yet — keys provisioned via the Miser API appear here with their spend attribution.
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
