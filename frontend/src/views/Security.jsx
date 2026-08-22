import { useSvc, Panel, Table, Guard } from '../components.jsx'
import { fmtInt } from '../api.js'

export default function Security() {
  const { data, error, loading } = useSvc('sentiel', [
    ['stats', '/api/stats'],
    ['dlp', '/api/dlp/violations?limit=20'],
    ['soc2', '/api/compliance/soc2'],
  ])

  const stats = data.stats ?? {}
  const dlp = Array.isArray(data.dlp) ? data.dlp : []
  const soc2 = data.soc2 ?? {}

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🔍 Security &amp; Compliance</h1>
        <p className="text-slate-400 mt-1">Sentiel — DLP inspection, anomaly detection, compliance evidence.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-3 gap-4">
          <Panel title="Events ingested"><p className="text-3xl font-bold text-indigo-400">{fmtInt(stats.total_events ?? stats.events)}</p></Panel>
          <Panel title="DLP violations"><p className="text-3xl font-bold text-rose-400">{fmtInt(dlp.length || stats.dlp_violations)}</p></Panel>
          <Panel title="Anomaly alerts"><p className="text-3xl font-bold text-amber-300">{fmtInt(stats.anomaly_alerts ?? stats.alerts)}</p></Panel>
        </div>

        <Panel title="Compliance snapshot" subtitle="Control-mapped summary (SOC 2)">
          <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(soc2.summary ?? soc2, null, 2)}
          </pre>
        </Panel>

        <Panel title="Recent DLP violations" subtitle="Pattern-matched secrets & PII caught in flight">
          <Table
            cols={['Time', 'Event', 'Pattern', 'Severity']}
            rows={[...dlp]
              .reverse()
              .slice(0, 20)
              .map((v) => ({
                Time: (v.detected_at ?? v.timestamp ?? '').replace('T', ' ').slice(0, 19),
                Event: (v.event_id ?? '').slice(0, 12),
                Pattern: v.pattern_name,
                Severity: v.severity,
              }))}
            empty="No violations detected — clean traffic."
          />
        </Panel>
      </Guard>
    </div>
  )
}
