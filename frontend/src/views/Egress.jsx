import { useSvc, Panel, Table, Guard } from '../components.jsx'
import { fmtInt } from '../api.js'

export default function Egress() {
  const { data, error, loading } = useSvc('aegis', [
    ['stats', '/api/egress/stats'],
    ['log', '/api/egress/log?limit=25'],
  ])

  const stats = data.stats ?? {}
  const log = Array.isArray(data.log) ? data.log : []

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🌐 Network Egress</h1>
        <p className="text-slate-400 mt-1">Aegis — destination allowlists, agent attestation, decision audit.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-4 gap-4">
          <Panel title="Allowed"><p className="text-3xl font-bold text-emerald-400">{fmtInt(stats.allowed)}</p></Panel>
          <Panel title="Blocked"><p className="text-3xl font-bold text-rose-400">{fmtInt(stats.blocked)}</p></Panel>
          <Panel title="Active policies"><p className="text-3xl font-bold text-indigo-400">{fmtInt(stats.active_policies ?? stats.policies)}</p></Panel>
          <Panel title="Pruned (retention)"><p className="text-3xl font-bold text-slate-300">{fmtInt(stats.pruned_total)}</p></Panel>
        </div>

        <Panel title="Egress decision log" subtitle="Latest first">
          <Table
            cols={['Time', 'Agent', 'Destination', 'Verdict', 'Reason']}
            rows={[...log]
              .reverse()
              .slice(0, 25)
              .map((e) => ({
                Time: (e.timestamp ?? '').replace('T', ' ').slice(0, 19),
                Agent: (e.agent_id ?? '').slice(0, 14),
                Destination: e.destination,
                Verdict: e.status,
                Reason: e.reason,
              }))}
            empty="No egress decisions recorded."
          />
        </Panel>
      </Guard>
    </div>
  )
}
