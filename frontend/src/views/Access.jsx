import { useEffect, useState } from 'react'

export default function Access() {
  const [policies, setPolicies] = useState(null)
  const [err, setErr] = useState('')
  const [approvals, setApprovals] = useState([])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [resources, setResources] = useState([])
  const [simulation, setSimulation] = useState({ action: 'call', resource: 'mcp/*', definition: '', result: null })

  useEffect(() => {
    fetch('/api/bff/policies')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setPolicies(d.policies ?? d))
      .catch((e) => setErr(String(e.message || e)))

    fetch('/api/svc/patroclus/v1/principal/approvals')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then(setApprovals)
      .catch(() => setApprovals([]))
    fetch('/api/svc/patroclus/v1/sessions')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setSessions(Array.isArray(d) ? d : d.sessions ?? []))
      .catch(() => setSessions([]))
    fetch('/api/bff/access/resources')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => setResources(Array.isArray(data) ? data : data.resources ?? []))
      .catch(() => setResources([]))
  }, [])

  const createResource = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const response = await fetch('/api/bff/access/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name.value, uri: form.uri.value, actions: ['call'] }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Resource ${body.name ?? body.id} created.` : body.error })
  }

  const resolveApproval = async (approvalId) => {
    const approverId = window.prompt('Patroclus principal UUID:')
    if (!approverId) return
    const response = await fetch(`/api/bff/access/approvals/${approvalId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approver_id: approverId, reason: 'Approved from Governance Hub' }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Approval resolved.' : body.error })
    if (response.ok) setApprovals((current) => current.filter((item) => item.id !== approvalId))
  }

  const killSession = async (sessionId) => {
    const response = await fetch(`/api/bff/access/sessions/${sessionId}/kill`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Session killed.' : body.error })
    if (response.ok) setSessions((current) => current.filter((item) => (item.id ?? item.session_id) !== sessionId))
  }

  const inspectSession = async (sessionId) => {
    const response = await fetch(`/api/bff/access/sessions/${encodeURIComponent(sessionId)}`)
    const body = await response.json().catch(() => ({}))
    setSelectedSession(response.ok ? body : { error: body.error || `status ${response.status}` })
  }

  const revokeToken = async () => {
    const tokenId = window.prompt('Token JTI:')
    if (!tokenId?.trim()) return
    const reason = window.prompt('Required revocation reason:')
    if (!reason?.trim()) return
    const response = await fetch(`/api/bff/access/tokens/${encodeURIComponent(tokenId)}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Token ${tokenId} revoked.` : body.error })
  }

  const issueDelegation = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const response = await fetch('/api/bff/access/delegations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent_id: form.agent_id.value,
        scopes: form.scopes.value.split(',').map((scope) => scope.trim()).filter(Boolean),
        expires_in_seconds: Number(form.expires.value),
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Delegation ${body.grant_id} issued. Token remains backend-issued and is not displayed.` : body.error })
  }

  const revokeGrant = async () => {
    const grantId = window.prompt('Grant ID:')
    if (!grantId?.trim()) return
    const response = await fetch(`/api/bff/access/grants/${encodeURIComponent(grantId)}/revoke`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Grant ${grantId} revoked.` : body.error })
  }

  const runSimulation = async (event) => {
    event.preventDefault()
    const response = await fetch('/api/bff/access/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: simulation.action,
        resource: simulation.resource,
        requested_scopes: [],
        definition: simulation.definition,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setSimulation((current) => ({ ...current, result: response.ok ? body : { error: body.error } }))
  }

  const list = Array.isArray(policies)
    ? policies
    : Array.isArray(policies?.policies)
      ? policies.policies
      : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Access</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Policy decisions enforced by Patroclus across every agent call.
        </p>
      </div>
      {err && <div className="panel p-4 text-[13px] text-amber-400/90">Patroclus unavailable — {err}</div>}
      <section className="panel overflow-hidden" data-testid="pending-approvals">
        <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Pending approvals</span></div>
        {approvals.length ? approvals.map((item) => (
          <div key={item.id} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{item.id}</span>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`approve-${item.id}`} onClick={() => resolveApproval(item.id)}>Approve</button>
          </div>
        )) : <div className="p-6 text-sm text-slate-600">No pending approvals.</div>}
      </section>

      <section className="panel overflow-hidden" data-testid="live-sessions">
        <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Live sessions</span></div>
        {sessions.length ? sessions.map((session) => (
          <div key={session.id ?? session.session_id} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{session.id ?? session.session_id}</span>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`inspect-${session.id ?? session.session_id}`} onClick={() => inspectSession(session.id ?? session.session_id)}>Inspect</button>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`kill-${session.id ?? session.session_id}`} onClick={() => killSession(session.id ?? session.session_id)}>Kill</button>
          </div>
        )) : <div className="p-6 text-sm text-slate-600" data-testid="no-sessions">No live sessions.</div>}
      </section>

      {selectedSession && (
        <section className="panel p-5" data-testid="session-inspector">
          <h2 className="font-semibold">Session inspector</h2>
          {selectedSession.error ? (
            <p className="text-sm text-rose-400">{selectedSession.error}</p>
          ) : (
            <pre className="mt-3 text-xs font-mono text-slate-300 whitespace-pre-wrap">{JSON.stringify(selectedSession, null, 2)}</pre>
          )}
        </section>
      )}

      <section className="panel p-5" data-testid="token-revocation">
        <h2 className="font-semibold">Revoke token</h2>
        <p className="text-xs text-slate-500 mt-1">Immediately rejects the supplied JTI at Patroclus.</p>
        <button className="btn btn-primary mt-3" onClick={revokeToken}>Select token</button>
      </section>

      <section className="panel overflow-hidden" data-testid="resource-list">
        <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Protected resources</span></div>
        {resources.length ? resources.map((resource) => (
          <div key={resource.id} className="px-4 py-2 border-t border-[#232833]/60 text-sm text-slate-300">{resource.name}</div>
        )) : <div className="p-6 text-sm text-slate-600">No resources registered.</div>}
      </section>

      <form className="panel p-5 space-y-3" onSubmit={createResource}>
        <h2 className="font-semibold">Create resource</h2>
        <input name="name" required placeholder="resource name" />
        <input name="uri" required placeholder="api/service/*" />
        <button className="btn btn-primary">Create</button>
      </form>

      <form className="panel p-5 space-y-3" data-testid="delegation-form" onSubmit={issueDelegation}>
        <h2 className="font-semibold">Issue delegation</h2>
        <input name="agent_id" required placeholder="Patroclus agent UUID" />
        <input name="scopes" required placeholder="relay:call,miser:route" />
        <input name="expires" type="number" min="60" defaultValue="900" />
        <button className="btn btn-primary" data-testid="delegation-submit">Issue</button>
      </form>

      <section className="panel p-5">
        <h2 className="font-semibold">Grants</h2>
        <button className="btn btn-primary mt-3" onClick={revokeGrant}>Revoke by ID</button>
      </section>

      <form className="panel p-5 space-y-3" data-testid="policy-simulator" onSubmit={runSimulation}>
        <h2 className="font-semibold">Policy simulator</h2>
        <p className="text-xs text-slate-500">Advisory preview against the YAML below; Patroclus remains the enforcement authority.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <input data-testid="simulate-action" value={simulation.action} onChange={(event) => setSimulation({ ...simulation, action: event.target.value })} />
          <input data-testid="simulate-resource" value={simulation.resource} onChange={(event) => setSimulation({ ...simulation, resource: event.target.value })} />
        </div>
          <textarea data-testid="simulate-yaml" rows="5" placeholder="YAML policy rules" value={simulation.definition} onChange={(event) => setSimulation({ ...simulation, definition: event.target.value })} />
        <button className="btn btn-primary" data-testid="simulate-run">Simulate</button>
        {simulation.result && (
          <pre className="text-xs text-slate-300" data-testid="simulation-result">{JSON.stringify(simulation.result, null, 2)}</pre>
        )}
      </form>

      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'}>{message.text}</div>}
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Active policies</span>
          <span className="num text-[11px] text-slate-600">{list.length}</span>
        </div>
        <table className="data">
          <thead><tr><th>Name</th><th>Engine</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id ?? p.name}>
                <td className="text-slate-200">{p.name}</td>
                <td><span className="badge badge-mono !text-[10px]">{p.engine}</span></td>
                <td><span className="badge badge-ok">{p.status ?? 'active'}</span></td>
              </tr>
            ))}
            {!list.length && !err && (
              <tr><td colSpan="3" className="text-center py-8 text-slate-600">No policies defined</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
