import { useSvc, Panel, Table, Guard, Modal, usePagination, PaginationControls } from '../components.jsx'
import { fmtInt } from '../api.js'
import { useEffect, useState } from 'react'

export default function Egress() {
  const { data, error, loading } = useSvc('aegis', [
    ['stats', '/api/egress/stats'],
    ['log', '/api/egress/log?limit=25'],
  ])
  const [message, setMessage] = useState(null)
  const [policyDialog, setPolicyDialog] = useState(false)
  const [policies, setPolicies] = useState([])

  const loadPolicies = () => {
    fetch('/api/bff/aegis/policies')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((list) => setPolicies(Array.isArray(list) ? list : []))
      .catch(() => setPolicies([]))
  }

  useEffect(loadPolicies, [])

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
    if (response.ok) {
      setPolicyDialog(false)
      loadPolicies()
    }
  }

  const stats = data.stats ?? {}
  const logPage = usePagination([...(Array.isArray(data.log) ? data.log : [])].reverse(), 20)
  const policyPage = usePagination(policies, 20)

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
            rows={logPage.pageItems.map((e) => ({
              Time: (e.timestamp ?? '').replace('T', ' ').slice(0, 19),
              Agent: (e.agent_id ?? '').slice(0, 14),
              Destination: e.destination,
              Verdict: e.status,
              Reason: e.reason,
            }))}
            empty="No egress decisions recorded."
          />
          <PaginationControls testIdPrefix="egress-log" page={logPage.page} totalPages={logPage.totalPages} total={logPage.total} singular="decision" plural="decisions" onPageChange={logPage.setPage} />
        </Panel>

        <Panel title="Destination policies" subtitle="Allow or block destinations through Aegis">
          <div className="p-4 border-b border-[#232833]">
            <button type="button" className="btn btn-primary" data-testid="open-policy-dialog" onClick={() => setPolicyDialog(true)}>New destination policy</button>
          </div>
          {policyPage.pageItems.length ? policyPage.pageItems.map((policy) => (
            <div key={policy.destination} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2 text-sm text-slate-300" data-testid={`policy-${policy.destination}`}>
              <span>{policy.destination}</span>
              <span className={`badge ${policy.action === 'block' ? 'badge-crit' : 'badge-ok'}`}>{policy.action}</span>
              {policy.owner && <span className="text-xs text-slate-500">owner {policy.owner}</span>}
            </div>
          )) : <div className="p-6 text-sm text-slate-600">No destination policies configured.</div>}
          <PaginationControls testIdPrefix="egress-policies" page={policyPage.page} totalPages={policyPage.totalPages} total={policyPage.total} singular="policy" plural="policies" onPageChange={policyPage.setPage} />
        </Panel>
      </Guard>
      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'} data-testid="policy-result">{message.text}</div>}
      <Modal open={policyDialog} title="New destination policy" description="Allow or block an outbound destination for every governed agent." onClose={() => setPolicyDialog(false)}>
        <form onSubmit={createPolicy} className="grid gap-4" data-testid="destination-policy-form">
          <input name="destination" required placeholder="api.example.test" />
          <select name="action">
            <option value="allow">allow</option>
            <option value="block">block</option>
          </select>
          <input name="reason" required placeholder="reason" />
          <button className="btn btn-primary" data-testid="save-policy">Save policy</button>
        </form>
      </Modal>
    </div>
  )
}
