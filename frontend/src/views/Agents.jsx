import { svcGet, fmtInt } from '../api.js'
import { useSvc, Panel, Table, Guard } from '../components.jsx'

export default function Agents() {
  const { data, error, loading } = useSvc('hive', [
    ['agents', '/api/agents'],
    ['delegations', '/api/delegations?limit=20'],
    ['wallet', '/api/wallet/stats'],
  ])

  const agents = Array.isArray(data.agents) ? data.agents : data.agents?.agents ?? []
  const delegations = Array.isArray(data.delegations) ? data.delegations : []
  const wallet = data.wallet ?? {}

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🐝 Agents</h1>
        <p className="text-slate-400 mt-1">Hive — agent runtime, marketplace &amp; delegation economy.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-3 gap-4">
          <Panel title="Registered agents"><p className="text-3xl font-bold text-indigo-400">{fmtInt(agents.length)}</p></Panel>
          <Panel title="Delegations (recent)"><p className="text-3xl font-bold text-cyan-300">{fmtInt(delegations.length)}</p></Panel>
          <Panel title="Wallet activity">
            <p className="text-3xl font-bold text-emerald-400">{fmtInt(wallet.total_transactions ?? wallet.transactions)}</p>
          </Panel>
        </div>

        <Panel title="Agent roster" subtitle="Live from Hive marketplace registry">
          <Table
            cols={['Name', 'Type', 'Status', 'Owner']}
            rows={agents.map((a) => ({
              Name: a.name ?? a.username,
              Type: a.agent_type ?? a.type,
              Status: a.status,
              Owner: a.owner_username ?? a.owner,
            }))}
            empty="No agents registered yet."
          />
        </Panel>

        {delegations.length > 0 && (
          <Panel title="Recent delegations">
            <Table
              cols={['ID', 'From', 'To', 'Task', 'Status']}
              rows={delegations.map((d) => ({
                ID: (d.id ?? '').slice(0, 8),
                From: d.delegating_agent ?? d.from_agent,
                To: d.executing_agent ?? d.to_agent,
                Task: d.task_description ?? d.task,
                Status: d.status,
              }))}
            />
          </Panel>
        )}
      </Guard>
    </div>
  )
}
