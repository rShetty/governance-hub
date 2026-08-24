import { useEffect, useState } from 'react'
import { fetchServices, svcGet } from '../api.js'

function useFleet() {
  const [services, setServices] = useState(null)
  const [err, setErr] = useState('')
  const [kpi, setKpi] = useState({ agents: null, spend: null, alerts: null })
  const [signals, setSignals] = useState([])
  useEffect(() => {
    fetchServices().then(setServices).catch((e) => setErr(String(e.message || e)))
    // KPI band: agent identities from Argus dir, spend from Miser, alerts from Sentiel
    svcGet('hive', '/api/agents')
      .then((d) => setKpi((k) => ({ ...k, agents: (d.items ?? d.agents ?? []).length })))
      .catch(() => setKpi((k) => ({ ...k, agents: '—' })))
    fetch('/api/bff/fleet').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return
      const keys = d.miser?.stats?.keys
      setKpi((k) => ({ ...k, spend: Array.isArray(keys) ? keys.length + ' keys' : '—' }))
      const evs = d.sentiel?.events
      const alerts = Array.isArray(evs) ? evs.length : null
      setKpi((k) => ({ ...k, alerts: alerts ?? '—' }))
    }).catch(() => {})
    fetch('/api/bff/activity?limit=20')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('activity unavailable'))))
      .then((data) => setSignals(data.items ?? []))
      .catch(() => setSignals([]))
    const t = setInterval(() => fetchServices().then(setServices).catch(() => {}), 15000)
    return () => clearInterval(t)
  }, [])
  return { services, err, kpi, signals }
}

function HealthRow({ s }) {
  const status = s?.healthy
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[#232833]/60">
      <span className={`dot ${status ? 'dot-ok' : 'dot-crit'}`} />
      <span className="text-[13px] text-slate-200 flex-1">{s.label}</span>
      <span className="num text-[11px] text-slate-600">{s.latency_ms != null ? `${s.latency_ms}ms` : ''}</span>
      <span className={`badge ${status ? 'badge-ok' : 'badge-crit'}`}>{status ? 'up' : 'down'}</span>
    </div>
  )
}

export default function MissionControl() {
  const { services, err, kpi, signals } = useFleet()
  const list = services?.services ?? []
  const up = list.filter((s) => s.healthy).length
  const criticalSignals = signals.filter((signal) => /violation|blocked|revoked|critical/i.test(String(signal.kind))).length

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="h-display text-[30px] leading-tight">Mission Control</h1>
        <p className="text-[13px] text-slate-500 mt-1">Operational posture, governance risk, and control coverage in one place.</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="panel p-5 flex flex-col justify-between min-h-[124px]">
          <div className="label mb-2">Backends up</div>
          <div>
          <div className="num text-[32px] leading-none text-slate-100">{services ? `${up}/${list.length}` : '—'}</div>
            <div className="text-xs text-slate-600 mt-2">live fleet health</div>
          </div>
        </div>
        <div className="panel p-5 flex flex-col justify-between min-h-[124px]">
          <div className="label mb-2">Agent identities</div>
          <div>
            <div className="num text-[32px] leading-none text-slate-100">{kpi.agents ?? '—'}</div>
            <div className="text-xs text-slate-600 mt-2">machine principals</div>
          </div>
        </div>
        <div className="panel p-5 flex flex-col justify-between min-h-[124px]">
          <div className="label mb-2">Spend today</div>
          <div>
            <div className="num text-[32px] leading-none text-teal-300">{kpi.spend ?? '—'}</div>
            <div className="text-xs text-slate-600 mt-2">routing keys active</div>
          </div>
        </div>
        <div className="panel p-5 flex flex-col justify-between min-h-[124px]">
          <div className="label mb-2">Open alerts</div>
          <div>
            <div className={`num text-[32px] leading-none ${Number(kpi.alerts) > 0 ? 'text-amber-300' : 'text-slate-100'}`}>{kpi.alerts ?? '—'}</div>
            <div className="text-xs text-slate-600 mt-2">recent risk events</div>
          </div>
        </div>
        <div className="panel p-5 flex flex-col justify-between min-h-[124px]">
          <div className="label mb-2">Critical signals</div>
          <div>
            <div className={`num text-[32px] leading-none ${criticalSignals > 0 ? 'text-rose-300' : 'text-slate-100'}`}>{signals.length ? criticalSignals : '—'}</div>
            <div className="text-xs text-slate-600 mt-2">require review</div>
          </div>
        </div>
      </div>

      {err && (
        <div className="panel p-4 text-sm text-rose-300 border-rose-500/30">{err}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fleet health */}
        <section className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Backend fleet</span>
            <span className="num text-[11px] text-slate-600">auto-refresh 15s</span>
          </div>
          {!services && !err && <div className="p-4 text-sm text-slate-600">Probing…</div>}
          {list.map((s) => <HealthRow key={s.id} s={s} />)}
          {!list.length && !err && <div className="p-8 text-center text-sm text-slate-600">No backend status available.</div>}
        </section>

        {/* Recent signals */}
        <section className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Recent signals</span>
            <span className="num text-[11px] text-slate-600">{signals.length}</span>
          </div>
          <div id="signals-feed" data-testid="mission-signals" className="max-h-[360px] overflow-y-auto">
            {!signals.length && <div className="p-8 text-center text-sm text-slate-600">No recent signals.</div>}
            {signals.slice(0, 12).map((signal, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-2 border-t border-[#232833]/60">
                <span className="badge badge-mono !text-[10px]">{signal.source}</span>
                <span className="text-[13px] text-slate-200">{String(signal.kind)}</span>
                <span className="ml-auto num text-[11px] text-slate-600">{String(signal.ts ?? '').slice(11, 19)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
