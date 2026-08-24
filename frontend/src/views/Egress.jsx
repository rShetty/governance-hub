import { useSvc, Panel, Table, Guard } from '../components.jsx'
import { fmtInt } from '../api.js'
import { useState } from 'react'

export default function Egress() {
  const { data, error, loading } = useSvc('aegis', [
    ['stats', '/api/egress/stats'],
    ['log', '/api/egress/log?limit=25'],
    ['policies', '/api/policy/destinations'],
  ])
  const [message, setMessage] = useState(null)

  const createPolicy = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const response = await fetch('/api/bff/aegis/policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        destination: form.destination.value,
        action: form.action.value,
        reason: form.reason.value,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Policy ${body.destination ?? body.id} saved.` : body.error })
  }

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

        <Panel title="Destination policies" subtitle="Allow or block destinations through Aegis">
          <form onSubmit={createPolicy} className="p-4 space-y-3 border-b border-[#232833]" data-testid="destination-policy-form">
            <input name="destination" required placeholder="api.example.test" />
            <select name="action">
              <option value="allow">allow</option>
              <option value="block">block</option>
            </select>
            <input name="reason" required placeholder="reason" />
            <button className="btn btn-primary" data-testid="save-policy">Save policy</button>
          </form>
          {Array.isArray(data.policies) && data.policies.length ? data.policies.map((policy) => (
            <div key={policy.destination} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2 text-sm text-slate-300" data-testid={`policy-${policy.destination}`}>
              <span>{policy.destination}</span>
              <span className={`badge ${policy.action === 'block' ? 'badge-crit' : 'badge-ok'}`}>{policy.action}</span>
              {policy.owner && <span className="text-xs text-slate-500">owner {policy.owner}</span>}
            </div>
          )) : <div className="p-6 text-sm text-slate-600">No destination policies configured.</div>}
        </Panel>
      </Guard>
      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'} data-testid="policy-result">{message.text}</div>}
    </div>
  )
}
