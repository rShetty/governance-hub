import { useEffect, useState } from 'react'
import { ConfirmDialog, PromptDialog, ResourceSelect, useToast } from '../components.jsx'

export default function Access() {
  const [policies, setPolicies] = useState(null)
  const [err, setErr] = useState('')
  const [approvals, setApprovals] = useState([])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [resources, setResources] = useState([])
  const [simulation, setSimulation] = useState({ action: 'call', resource: '', result: null })
  const toast = useToast()
  const [approvalDialog, setApprovalDialog] = useState(null)
  const [tokenDialog, setTokenDialog] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [killSessionId, setKillSessionId] = useState(null)
  const [grantDialog, setGrantDialog] = useState(null)
  const [resourceDialog, setResourceDialog] = useState(false)
  const [delegationDialog, setDelegationDialog] = useState(false)
  const [agents, setAgents] = useState([])
  const [denyDialog, setDenyDialog] = useState(null)
  const [policyDelete, setPolicyDelete] = useState(null)
  const [resourceDetail, setResourceDetail] = useState(null)

  const loadPolicies = () => {
    fetch('/api/bff/policies')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setPolicies(d.policies ?? d))
      .catch((e) => setErr(String(e.message || e)))
  }

  useEffect(() => {
    loadPolicies()

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
    fetch('/api/bff/directory/agents')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => setAgents([]))
  }, [])

  const createResource = async ({ name, uri }) => {
    if (!name?.trim() || !uri?.trim()) return
    const response = await fetch('/api/bff/access/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), uri: uri.trim(), actions: ['call'] }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Resource ${body.name ?? body.id} created.` : body.error })
    if (response.ok) { toast.success(`Resource ${body.name ?? body.id} created.`); setResources((current) => [...current, { id: body.id ?? name, name: body.name ?? name }]) }
    setResourceDialog(false)
  }

  const resolveApproval = async (approvalId, reason = 'Approved from Governance Hub') => {
    const response = await fetch(`/api/bff/access/approvals/${approvalId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Approval resolved.' : body.error })
    if (response.ok) { toast.success('Approval resolved.') } else { toast.error(body.error || 'Approval failed.') }
    if (response.ok) setApprovals((current) => current.filter((item) => item.id !== approvalId))
  }

  const denyApproval = async (dialogValues) => {
    const approvalId = denyDialog?.id
    const reason = dialogValues?.reason?.trim()
    if (!approvalId || !reason) return
    const response = await fetch(`/api/bff/access/approvals/${encodeURIComponent(approvalId)}/deny`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Approval ${approvalId} denied.` : body.error })
    if (response.ok) { toast.success(`Approval ${approvalId} denied.`) } else { toast.error(body.error || 'Denial failed.') }
    if (response.ok) setApprovals((current) => current.filter((item) => item.id !== approvalId))
    setDenyDialog(null)
  }

  const deletePolicy = async () => {
    const policyId = policyDelete?.id
    if (!policyId) return
    const response = await fetch(`/api/bff/policies/${encodeURIComponent(policyId)}`, { method: 'DELETE' })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Policy ${policyDelete.name} deleted.` : body.error })
    if (response.ok) { toast.success(`Policy ${policyDelete.name} deleted.`) } else { toast.error(body.error || 'Delete failed.') }
    if (response.ok) setPolicies((current) => {
      const rows = Array.isArray(current) ? current : current?.policies ?? []
      return rows.filter((item) => String(item.id ?? item.name) !== String(policyId))
    })
    setPolicyDelete(null)
  }

  const openResourceDetail = async (resourceId) => {
    const response = await fetch(`/api/bff/access/resources/${encodeURIComponent(resourceId)}`)
    const body = await response.json().catch(() => ({}))
    setResourceDetail(response.ok ? body : { error: body.error || `status ${response.status}` })
  }

  const issueDelegationWithAgent = async (agentId, scopes, expiresIn = 900) => {
    const response = await fetch('/api/bff/access/delegations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        scopes: scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
        expires_in_seconds: Number(expiresIn),
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (response.ok) { toast.success(`Delegation ${body.grant_id} issued.`); setDelegationDialog(false) } else { toast.error(body.error || 'Delegation failed.') }
  }

  const killSession = async (sessionId) => {
    const response = await fetch(`/api/bff/access/sessions/${sessionId}/kill`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (response.ok) { toast.success('Session killed.') } else { toast.error(body.error || 'Kill failed.') }
    if (response.ok) setSessions((current) => current.filter((item) => (item.id ?? item.session_id) !== sessionId))
  }

  const inspectSession = async (sessionId) => {
    const response = await fetch(`/api/bff/access/sessions/${encodeURIComponent(sessionId)}`)
    const body = await response.json().catch(() => ({}))
    setSelectedSession(response.ok ? body : { error: body.error || `status ${response.status}` })
  }

  const revokeToken = async (dialogValues) => {
    const { token_id: tokenId, reason } = dialogValues ?? tokenDialog?.values ?? {}
    if (!tokenId || !reason) return
    const response = await fetch(`/api/bff/access/tokens/${encodeURIComponent(tokenId)}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Token ${tokenId} revoked.` : body.error })
    if (response.ok) { toast.success(`Token ${tokenId} revoked.`) } else { toast.error(body.error || 'Revocation failed.') }
    setTokenDialog(null)
  }

  const revokeGrant = async (dialogValues) => {
    const { grant_id: grantId } = dialogValues ?? grantDialog?.values ?? {}
    if (!grantId?.trim()) return
    const response = await fetch(`/api/bff/access/grants/${encodeURIComponent(grantId)}/revoke`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (response.ok) { toast.success(`Grant ${grantId} revoked.`) } else { toast.error(body.error || 'Revocation failed.') }
    setGrantDialog(null)
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
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`approve-${item.id}`} onClick={() => setApprovalDialog({ id: item.id, values: {} })}>Approve</button>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`deny-${item.id}`} onClick={() => setDenyDialog({ id: item.id, values: {} })}>Deny</button>
          </div>
        )) : <div className="p-6 text-sm text-slate-600">No pending approvals.</div>}
      </section>

      <section className="panel overflow-hidden" data-testid="live-sessions">
        <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Live sessions</span></div>
        {sessions.length ? sessions.map((session) => (
          <div key={session.id ?? session.session_id} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{session.id ?? session.session_id}</span>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`inspect-${session.id ?? session.session_id}`} onClick={() => inspectSession(session.id ?? session.session_id)}>Inspect</button>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`kill-${session.id ?? session.session_id}`} onClick={() => setKillSessionId(session.id ?? session.session_id)}>Kill</button>
          </div>
        )) : <div className="p-6 text-sm text-slate-600" data-testid="no-sessions">No live sessions.</div>}
      </section>

      {selectedSession && (
        <section className="panel p-5" data-testid="session-inspector">
          <h2 className="font-semibold">Session inspector</h2>
          {selectedSession.error ? (
            <p className="text-sm text-rose-400">{selectedSession.error}</p>
          ) : (
            <div className="mt-3 grid gap-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div><span className="label">Session</span><p className="font-mono text-xs text-slate-300">{selectedSession.session_id}</p></div>
                <div><span className="label">Principal</span><p className="font-mono text-xs text-slate-300">{selectedSession.agent_id}</p></div>
                <div><span className="label">Actions</span><p className="text-sm text-slate-300">{selectedSession.actions_count}</p></div>
                <div><span className="label">Trust level</span><p className="text-sm text-slate-300">{selectedSession.trust_level}</p></div>
              </div>
              {Array.isArray(selectedSession.trajectory) && selectedSession.trajectory.length > 0 && (
                <div data-testid="session-trajectory">
                  <span className="label">Trajectory</span>
                  <ol className="mt-2 space-y-2 border-l border-[#232833] pl-4">
                    {selectedSession.trajectory.map((step, index) => (
                      <li key={index} className="text-xs text-slate-300">
                        <span className="font-mono text-[10px] text-slate-500">{step.ts}</span>{' '}
                        <span className="badge badge-mono !text-[10px]">{step.kind}</span>{' '}
                        {step.summary}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {selectedSession.constraints && (
                <div data-testid="session-constraints">
                  <span className="label">Constraints</span>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                    {(selectedSession.constraints.scopes ?? []).map((scope) => <span key={scope} className="badge badge-mono !text-[10px]">{scope}</span>)}
                    {selectedSession.constraints.rate_limit_rpm != null && <span className="badge !text-[10px]">RPM ≤ {selectedSession.constraints.rate_limit_rpm}</span>}
                    {selectedSession.constraints.monthly_budget_usd != null && <span className="badge !text-[10px]">Budget ${selectedSession.constraints.monthly_budget_usd}</span>}
                    {selectedSession.constraints.spend_total_usd != null && <span className="badge !text-[10px]">Spent ${selectedSession.constraints.spend_total_usd}</span>}
                    {selectedSession.constraints.expires_at && <span className="badge !text-[10px]">Expires {selectedSession.constraints.expires_at}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Create and revoke</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => setResourceDialog(true)} data-testid="open-resource-dialog">Resource</button>
          <button type="button" className="btn" onClick={() => setDelegationDialog(true)} data-testid="open-delegation-dialog">Delegation</button>
          <button type="button" className="btn btn-primary" data-testid="open-token-revocation" onClick={() => setTokenDialog({ values: {} })}>Revoke token</button>
        </div>
      </div>

      <section className="panel overflow-hidden" data-testid="resource-list">
        <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Protected resources</span></div>
        {resources.length ? resources.map((resource) => (
          <div key={resource.id} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-2 text-sm text-slate-300">
            <span>{resource.name}</span>
            <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`resource-detail-${resource.id}`} onClick={() => openResourceDetail(resource.id)}>Detail</button>
          </div>
        )) : <div className="p-6 text-sm text-slate-600">No resources registered.</div>}
      </section>

      {resourceDialog && (
        <PromptDialog
          open
          title="Create protected resource"
          description="Resources are enforced by Patroclus policies."
          fields={[
            { name: 'name', label: 'Resource name' },
            { name: 'uri', label: 'Resource pattern', value: 'api/service/*' },
          ]}
          submitLabel="Create resource"
          busy={busyAction === 'resource'}
          onSubmit={(values) => createResource({ name: values.name, uri: values.uri })}
          onCancel={() => setResourceDialog(null)}
        />
      )}

      {delegationDialog && (
        <PromptDialog
          open
          title="Issue delegation"
          description="Grant scoped, time-limited access to a selected agent."
          fields={[
            { name: 'agent_id', label: 'Agent', type: 'select', options: agents.map(({ id, name, status }) => ({ id, name: `${name}${status ? ` · ${status}` : ''}` })) },
            { name: 'scopes', label: 'Scopes', value: 'relay:call,miser:route' },
            { name: 'expires', label: 'Expires in seconds', type: 'number', value: 900 },
          ]}
          submitLabel="Issue delegation"
          busy={busyAction === 'delegation'}
          onSubmit={(values) => issueDelegationWithAgent(values.agent_id, values.scopes, values.expires)}
          onCancel={() => setDelegationDialog(null)}
        />
      )}

      <section className="panel p-5">
        <h2 className="font-semibold">Grants</h2>
        <button className="btn btn-primary mt-3" data-testid="open-grant-revocation" onClick={() => setGrantDialog({ values: {} })}>Revoke grant</button>
      </section>

      {approvalDialog && (
        <PromptDialog
          open
          title="Resolve approval"
          description={`Approval ${approvalDialog.id} will be recorded with your principal ID.`}
          fields={[{ name: 'reason', label: 'Approval reason', value: 'Approved from Governance Hub' }]}
          submitLabel="Approve"
          busy={busyAction === 'approval'}
          onSubmit={(values) => resolveApproval(approvalDialog.id, values.reason || 'Approved from Governance Hub')}
          onCancel={() => setApprovalDialog(null)}
        />
      )}

      {tokenDialog && (
        <PromptDialog
          open
          title="Revoke access token"
          description="The token is rejected immediately. This action is audited."
          fields={[
  { name: 'token_id', label: 'Revoked token identifier' },
            { name: 'reason', label: 'Required reason', textarea: true },
          ]}
          submitLabel="Revoke token"
          busy={busyAction === 'token'}
          onSubmit={(values) => revokeToken(values)}
          onCancel={() => setTokenDialog(null)}
        />
      )}

      {grantDialog && (
        <PromptDialog
          open
          title="Revoke delegation grant"
          fields={[{ name: 'grant_id', label: 'Grant identifier' }]}
          submitLabel="Revoke"
          busy={busyAction === 'grant'}
          onSubmit={(values) => revokeGrant(values)}
          onCancel={() => setGrantDialog(null)}
        />
      )}

      {denyDialog && (
        <PromptDialog
          open
          title="Deny approval"
          description={`Approval ${denyDialog.id} will be rejected and audited.`}
          fields={[{ name: 'reason', label: 'Required reason', textarea: true }]}
          submitLabel="Deny approval"
          busy={busyAction === 'deny'}
          onSubmit={denyApproval}
          onCancel={() => setDenyDialog(null)}
        />
      )}

      {policyDelete && (
        <ConfirmDialog
          open
          title="Delete policy"
          message={`Policy ${policyDelete.name} (${policyDelete.id}) will be removed from Patroclus. This cannot be undone.`}
          confirmLabel="Delete policy"
          danger
          busy={busyAction === 'policy-delete'}
          onConfirm={deletePolicy}
          onCancel={() => setPolicyDelete(null)}
        />
      )}

      {resourceDetail && (
        <PromptDialog
          open
          title={`Resource detail · ${resourceDetail.name ?? resourceDetail.id}`}
          description={resourceDetail.error
            ? `Could not load detail — ${resourceDetail.error}`
            : `${resourceDetail.uri ?? '—'} · actions: ${(resourceDetail.actions ?? []).join(', ') || '—'} · sensitivity: ${resourceDetail.sensitivity ?? '—'} · owner: ${resourceDetail.owner ?? '—'} · linked policies: ${resourceDetail.policies_count ?? 0}`}
          fields={[]}
          submitLabel="Close"
          onSubmit={() => setResourceDetail(null)}
          onCancel={() => setResourceDetail(null)}
        />
      )}

      {killSessionId && (
        <ConfirmDialog
          open
          title="Kill live session"
          message={`Session ${killSessionId} will terminate immediately.`}
          confirmLabel="Kill session"
          danger
          busy={busyAction === `session-${killSessionId}`}
          onConfirm={async () => { await killSession(killSessionId); setKillSessionId(null) }}
          onCancel={() => setKillSessionId(null)}
        />
      )}

      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'}>{message.text}</div>}
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Active policies</span>
          <span className="num text-[11px] text-slate-600">{list.length}</span>
        </div>
        <table className="data">
          <thead><tr><th>Name</th><th>Engine</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id ?? p.name} data-testid={`policy-${p.id ?? p.name}`}>
                <td className="text-slate-200">{p.name}</td>
                <td><span className="badge badge-mono !text-[10px]">{p.engine}</span></td>
                <td><span className="badge badge-ok">{p.status ?? 'active'}</span></td>
                    <td className="space-x-1">
                      <button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`inspect-policy-${p.id ?? p.name}`} onClick={() => {
                        const policy = list.find((item) => String(item.id) === String(p.id ?? p.name))
                        setSimulation((current) => ({ ...current, action: current.action, resource: current.resource, result: null }))
                        setMessage({ ok: !!policy, text: policy ? `Policy ${policy.name}` : 'Policy definition unavailable.' })
                      }}>Details</button>
                      <button className="btn btn-ghost !py-1 !px-2 !text-[11px] !text-rose-400" data-testid={`delete-policy-${p.id ?? p.name}`} onClick={() => setPolicyDelete({ id: p.id ?? p.name, name: p.name })}>Delete</button>
                    </td>
              </tr>
            ))}
            {!list.length && !err && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-600">No policies defined</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
