import { useEffect, useState } from 'react'
import { fetchServices, svcGet } from '../api.js'
import { PageHeader } from '../components.jsx'

const QUICK_ACTIONS = [
  { label: 'Install MCP server', description: 'Register a provider with CIMD or dynamic registration.', target: '/tools' },
  { label: 'Open approvals', description: 'Approvals, live sessions, and policy simulation.', target: '/access' },
  { label: 'Create machine identity', description: 'Scoped machine principal with one-time secret.', target: '/agents' },
  { label: 'Show compliance evidence', description: 'Framework evidence, coverage, and gaps.', target: '/compliance' },
]

const KPI_TARGETS = {
  'Backends up': '/services',
  'Agent identities': '/agents',
  'Spend today': '/cost',
  'Open alerts': '/security',
  'Critical signals': '/activity',
}

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

function KpiCard({ label, value, helper, tone = '#f3f6fb', navigate }) {
  return (
    <button type="button" className="action-card" onClick={() => navigate?.(KPI_TARGETS[label])} data-testid={`kpi-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <span className="label">{label}</span>
      <span className="num text-3xl leading-none" style={{ color: tone }}>{value ?? '—'}</span>
      <span className="text-xs text-[#8d97a6]">{helper}</span>
      <span className="mt-auto text-sm font-semibold text-teal-300">Manage →</span>
    </button>
  )
}

export default function MissionControl() {
  const { services, err, kpi, signals } = useFleet()
  const list = services?.services ?? []
  const up = list.filter((s) => s.healthy).length
  const criticalSignals = signals.filter((signal) => /violation|blocked|revoked|critical/i.test(String(signal.kind))).length

  const attentionItems = [
    ...list.filter((service) => !service.healthy).map((service) => ({
      id: `service-${service.id}`,
      title: `${service.label} is down`,
      description: service.detail || 'The backend did not respond to the latest health probe.',
      severity: 'critical',
      actionLabel: 'Open registry',
      target: '/services',
    })),
    ...signals.filter((signal) => /violation|blocked|revoked|critical/i.test(String(signal.kind))).slice(0, 5).map((signal, index) => ({
      id: `signal-${index}`,
      title: String(signal.kind),
      description: signal.summary || `Source: ${signal.source}`,
      severity: signal.severity || 'high',
      actionLabel: 'Inspect activity',
      target: signal.session_id ? `/activity?session_id=${encodeURIComponent(signal.session_id)}` : '/activity',
    })),
  ]

  const goTo = (target) => {
    const routeId = target.split('?')[0].replace('/', '') || 'mission'
    window.history.pushState({ id: routeId }, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Mission Control"
        description="Operational posture, prioritized risk, and direct remediation paths for the governance control plane."
      />

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="h-display mb-4 text-xl">Attention required</h2>
        {attentionItems.length ? (
          <div className="panel overflow-hidden" data-testid="attention-required">
            {attentionItems.map((item) => (
              <article key={item.id} className="attention-item">
                <span className={`badge ${item.severity === 'critical' ? 'badge-crit' : 'badge-warn'}`}>{item.severity}</span>
                <div className="attention-item-main flex-1">
                  <p className="attention-item-title">{item.title}</p>
                  <p className="attention-item-description text-sm">{item.description}</p>
                </div>
                <button type="button" className="btn" onClick={() => goTo(item.target)}>{item.actionLabel}</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel p-6" data-testid="attention-clear">
            <p className="text-sm text-[#c9d1de]">No critical items require immediate action.</p>
          </div>
        )}
      </section>

      <section aria-label="Quick actions">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <button key={action.label} type="button" className="action-card" onClick={() => goTo(action.target)}>
              <span className="action-card-title">{action.label}</span>
              <span className="action-card-description text-sm">{action.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Governance metrics">
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard navigate={goTo} label="Backends up" value={services ? `${up}/${list.length}` : null} helper="live fleet health" />
          <KpiCard navigate={goTo} label="Agent identities" value={kpi.agents} helper="machine principals" />
          <KpiCard navigate={goTo} label="Spend today" value={kpi.spend} helper="routing keys active" tone="#5eead4" />
          <KpiCard navigate={goTo} label="Open alerts" value={kpi.alerts} helper="recent risk events" tone={Number(kpi.alerts) > 0 ? '#fbbf24' : undefined} />
          <KpiCard navigate={goTo} label="Critical signals" value={signals.length ? criticalSignals : null} helper="require review" tone={criticalSignals > 0 ? '#f87171' : undefined} />
        </div>
      </section>

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
