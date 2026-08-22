import { useEffect, useState } from 'react'

export default function Access() {
  const [policies, setPolicies] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    fetch('/api/bff/policies')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setPolicies(d.policies ?? d))
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  const list = Array.isArray(policies)
    ? policies
    : Array.isArray(policies?.policies)
      ? policies.policies
      : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Access</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Policy decisions enforced by Patroclus across every agent call.
        </p>
      </div>
      {err && <div className="panel p-4 text-[13px] text-amber-400/90">Patroclus unavailable — {err}</div>}
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Active policies</span>
          <span className="num text-[11px] text-slate-600">{list.length}</span>
        </div>
        <table className="data">
          <thead><tr><th>Name</th><th>Engine</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id ?? p.name}>
                <td className="text-slate-200">{p.name}</td>
                <td><span className="badge badge-mono !text-[10px]">{p.engine}</span></td>
                <td><span className="badge badge-ok">{p.status ?? 'active'}</span></td>
              </tr>
            ))}
            {!list.length && !err && (
              <tr><td colSpan="3" className="text-center py-8 text-slate-600">No policies defined</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
