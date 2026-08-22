import { useSvc, Panel, Table, Guard } from '../components.jsx'
import { fmtInt } from '../api.js'

export default function Policies() {
  const { data, error, loading } = useSvc('patroclus', [
    ['agents', '/v1/admin/agents'],
    ['audit', '/v1/admin/audit'],
    ['sessions', '/v1/sessions'],
  ])

  const agents = Array.isArray(data.agents) ? data.agents : []
  const audit = Array.isArray(data.audit) ? data.audit : []
  const sessions = data.sessions?.sessions ?? []

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🛡️ Policies &amp; Access</h1>
        <p className="text-slate-400 mt-1">Patroclus — scoped tokens, approvals, kill switch, tamper-evident audit.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-4 gap-4">
          <Panel title="Agents"><p className="text-3xl font-bold text-indigo-400">{fmtInt(agents.length)}</p></Panel>
          <Panel title="Active sessions"><p className="text-3xl font-bold text-cyan-300">{fmtInt(sessions.length)}</p></Panel>
          <Panel title="Audit entries"><p className="text-3xl font-bold text-emerald-400">{fmtInt(audit.length)}</p></Panel>
          <Panel title="Chain"><p className="text-sm text-slate-400 mt-2">SHA-256 hash-chained</p></Panel>
        </div>

        <Panel title="Registered principals &amp; agents">
          <Table
            cols={['Name', 'Type', 'Status', 'Created']}
            rows={agents.map((a) => ({
              Name: a.name,
              Type: a.principal_type,
              Status: a.status,
              Created: (a.created_at ?? '').slice(0, 19).replace('T', ' '),
            }))}
            empty="No agents provisioned."
          />
        </Panel>

        <Panel title="Authorization audit trail" subtitle="Hash-chained decision log (latest first)">
          <Table
            cols={['Time', 'Agent', 'Action', 'Resource', 'Decision']}
            rows={[...audit]
              .reverse()
              .slice(0, 25)
              .map((e) => ({
                Time: (e.timestamp ?? '').replace('T', ' ').slice(0, 19),
                Agent: e.agent_id,
                Action: e.action,
                Resource: e.resource,
                Decision: e.decision,
              }))}
            empty="No authorization decisions recorded yet."
          />
        </Panel>

        <Panel title="Live sessions" subtitle="Kill-switch capable">
          <Table
            cols={['Session', 'Agent', 'Started', 'Killed']}
            rows={sessions.map((s) => ({
              Session: (s.session_id ?? s.id ?? '').slice(0, 18),
              Agent: s.agent_id,
              Started: (s.started_at ?? '').replace('T', ' ').slice(0, 19),
              Killed: s.killed ? '🔴' : '—',
            }))}
            empty="No active sessions."
          />
        </Panel>
      </Guard>
    </div>
  )
}
