import { useEffect, useState } from 'react'
import { svcGet } from './api.js'

export function useSvc(serviceId, paths) {
  const [data, setData] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all(
      paths.map(([key, path]) =>
        svcGet(serviceId, path).then((v) => [key, v]).catch((e) => [key, { __error: e.message }]),
      ),
    ).then((entries) => {
      if (!alive) return
      setData(Object.fromEntries(entries))
      const errs = entries.filter(([, v]) => v.__error)
      setError(errs.length ? errs.map(([, v]) => v.__error).join(' · ') : null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [serviceId, JSON.stringify(paths)])

  return { data, error, loading }
}

export function Panel({ title, subtitle, children, actions }) {
  return (
    <div className="glass p-5 fade-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Table({ cols, rows, empty }) {
  if (!rows?.length) return <p className="text-sm text-slate-500 py-4">{empty ?? 'No records.'}</p>
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/40">
              {cols.map((c) => (
                <td key={c} className="px-2 py-2.5 align-top font-mono text-[12px] text-slate-300 max-w-[22ch] truncate" title={String(r[c] ?? '')}>
                  {r[c] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  // Degrade gracefully for auth/token issues — show a clean message, not raw JSON.
  const isAuthError = /401|403/.test(error)
  if (isAuthError) {
    return (
      <div className="panel p-4 text-sm text-slate-400 border-slate-700 mb-4" data-testid="svc-degraded">
        Some backend services are not yet connected to this deployment. Configure service tokens in the Hub environment to enable live data.
      </div>
    )
  }
  return (
    <div className="glass p-4 text-sm text-amber-300 border-amber-900/60 mb-4">
      ⚠︎ Service degraded or unreachable — {error}
    </div>
  )
}

export function Skeleton() {
  return <div className="glass h-64 animate-pulse" />
}

export function useLoaded(view) {
  return loading ? <Skeleton /> : null
}

export function Guard({ loading, error, children }) {
  return (
    <>
      <ErrorNote error={error} />
      {loading ? <Skeleton /> : children}
    </>
  )
}
