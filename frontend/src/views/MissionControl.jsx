import { useEffect, useState } from 'react'
import { fetchServices, svcGet } from '../api.js'

function useFleet() {
  const [services, setServices] = useState(null)
  const [err, setErr] = useState('')
  const [kpi, setKpi] = useState({ agents: null, spend: null, alerts: null })
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
    const t = setInterval(() => fetchServices().then(setServices).catch(() => {}), 15000)
    return () => clearInterval(t)
  }, [])
  return { services, err, kpi }
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
  const { services, err, kpi } = useFleet()
  const list = services?.services ?? []
  const up = list.filter((s) => s.healthy).length

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="h-display text-2xl">Mission Control</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Fleet posture across the governance stack.</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#232833] rounded-xl overflow-hidden border border-[#232833]">
        <div className="bg-[#10131a] p-5">
          <div className="label mb-2">Backends up</div>
          <div className="num text-[28px] leading-none text-slate-100">{services ? `${up}<span class="text-slate-600">/${list.length}` : '—'}</div>
        </div>
        <div className="bg-[#10131a] p-5">
          <div className="label mb-2">Agent identities</div>
          <div className="num text-[28px] leading-none text-slate-100">{kpi.agents ?? '—'}</div>
        </div>
        <div className="bg-[#10131a] p-5">
          <div className="label mb-2">Spend today</div>
          <div className="num text-[28px] leading-none text-teal-300">{kpi.spend ?? '—'}</div>
        </div>
        <div className="bg-[#10131a] p-5">
          <div className="label mb-2">Open alerts</div>
          <div className="num text-[28px] leading-none text-slate-100">{kpi.alerts ?? '—'}</div>
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
        </section>

        {/* Recent signals */}
        <section className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Recent signals</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-700">unified feed — P3</span>
          </div>
          <div id="signals-feed">
            <div className="p-8 text-center text-[13px] text-slate-600">
              Unified activity timeline lands in Phase 3.<br />
              <span className="text-slate-700">Hive delegations · Sentiel events · Aegis verdicts · Miser decisions</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
