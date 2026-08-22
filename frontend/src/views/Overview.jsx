import { useEffect, useState } from 'react'
import { fetchServices } from '../api.js'

const ICONS = {
  hive: '🐝', patroclus: '🛡️', relay: '🔌',
  miser: '💸', sentiel: '🔍', aegis: '🌐',
}

export default function Overview({ go }) {
  const [services, setServices] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchServices()
        .then((d) => alive && (setServices(d.services), setError(null)))
        .catch((e) => alive && setError(e.message))
    load()
    const t = setInterval(load, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const list = services ?? []
  const ok = list.filter((s) => s.healthy).length
  const lats = list.filter((s) => s.latency_ms).map((s) => s.latency_ms)
  const avgLat = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fleet Overview</h1>
        <p className="text-slate-400 mt-1 max-w-2xl">
          Live posture across the AI governance stack — agents, authorization,
          tool access, cost, compliance and egress.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Services', value: services ? list.length : '—', tone: 'text-indigo-400' },
          { label: 'Healthy', value: services ? ok : '—', tone: 'text-emerald-400' },
          { label: 'Degraded', value: services ? list.length - ok : '—', tone: 'text-rose-400' },
          { label: 'Avg latency', value: avgLat != null ? `${avgLat} ms` : '—', tone: 'text-cyan-300' },
        ].map((s) => (
          <div key={s.label} className="glass p-5 glow-ring">
            <div className={`text-2xl font-extrabold ${s.tone}`}>{s.value}</div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="glass p-4 text-rose-300 text-sm border-rose-900/60">Hub API unreachable — {error}</div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {list.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(s.id)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="glass p-5 text-left fade-up hover:border-indigo-500/50 hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xl">{ICONS[s.id] ?? '⚙️'}</span>
              <span
                className={`live-dot w-2.5 h-2.5 rounded-full ${s.healthy ? 'bg-emerald-400 shadow-emerald-400/50 shadow-md' : 'bg-rose-500'}`}
              />
            </div>
            <h3 className="font-semibold text-lg mt-3">{s.label}</h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2 min-h-[2.6em]">{s.description}</p>
            <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
              <span>{s.detail}{s.latency_ms != null && ` · ${s.latency_ms} ms`}</span>
              <span className="text-indigo-300 group-hover:translate-x-0.5 transition-transform">Open →</span>
            </div>
          </button>
        ))}
        {!services && !error &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-44 animate-pulse" />
          ))}
      </div>
    </div>
  )
}
