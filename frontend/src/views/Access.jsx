import { useEffect, useState } from 'react'
import { ConfirmDialog, PromptDialog, ResourceSelect, useToast, WizardModal } from '../components.jsx'

export default function Access() {
  const [policies, setPolicies] = useState(null)
  const [err, setErr] = useState('')
  const [approvals, setApprovals] = useState([])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [resources, setResources] = useState([])
  const [policyDraft, setPolicyDraft] = useState({
    name: '',
    effect: 'allow',
    actions: ['call'],
    resources: [],
    reason: '',
  })
  const [simulation, setSimulation] = useState({ action: 'call', resource: '', result: null })
  const toast = useToast()
  const [approvalDialog, setApprovalDialog] = useState(null)
  const [tokenDialog, setTokenDialog] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [killSessionId, setKillSessionId] = useState(null)
  const [grantDialog, setGrantDialog] = useState(null)
  const [policyWizard, setPolicyWizard] = useState(false)
  const [policyStep, setPolicyStep] = useState(0)
  const [agents, setAgents] = useState([])

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
    if (response.ok) { toast.success(`Delegation ${body.grant_id} issued.`) } else { toast.error(body.error || 'Delegation failed.') }
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

  const runSimulation = async (event) => {
    event.preventDefault()
    const response = await fetch('/api/bff/access/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: simulation.action,
        resource: simulation.resource,
        requested_scopes: [],
        definition: draftYaml(policyDraft),
      }),
    })
    const body = await response.json().catch(() => ({}))
    setSimulation((current) => ({ ...current, result: response.ok ? body : { error: body.error } }))
  }

  const updateRule = (patch) => {
    setPolicyDraft((current) => ({ ...current, ...patch }))
  }

  const draftYaml = (draft) => [
    '- name: ' + JSON.stringify(draft.name || 'untitled-policy'),
    `  actions: ${JSON.stringify(draft.actions.filter(Boolean))}`,
    `  resources: ${JSON.stringify(draft.resources.filter(Boolean))}`,
    `  decision: ${draft.effect}`,
    ...(draft.reason.trim() ? [`  reason: ${JSON.stringify(draft.reason.trim())}`] : []),
  ].join('\n')

  const policyDraftValid = policyDraft.name.trim().length >= 3
    && policyDraft.actions.some((action) => action.trim())
    && policyDraft.resources.some((resource) => resource.trim())

  const savePolicy = async () => {
    if (!policyDraftValid) return
    const response = await fetch('/api/bff/policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: policyDraft.name.trim(),
        engine: 'yaml',
        definition: draftYaml(policyDraft),
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(body.error || 'Policy creation failed.')
      return
    }
    toast.success(`Policy ${policyDraft.name} saved.`)
    setPolicyDraft({ name: '', effect: 'allow', actions: ['call'], resources: [], reason: '' })
    loadPolicies()
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
            <pre className="mt-3 text-xs font-mono text-slate-300 whitespace-pre-wrap">{JSON.stringify(selectedSession, null, 2)}</pre>
          )}
        </section>
      )}

      <section className="panel p-5" data-testid="token-revocation">
        <h2 className="font-semibold">Revoke token</h2>
        <p className="text-xs text-slate-500 mt-1">Immediately rejects the supplied JTI at Patroclus.</p>
        <button className="btn btn-primary mt-3" data-testid="open-token-revocation" onClick={() => setTokenDialog({ values: {} })}>Revoke token</button>
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

      <form className="panel p-5 space-y-3" data-testid="delegation-form" onSubmit={(event) => {
        event.preventDefault()
        issueDelegationWithAgent(
          new FormData(event.currentTarget).get('agent_id'),
          new FormData(event.currentTarget).get('scopes'),
          new FormData(event.currentTarget).get('expires'),
        )
      }}>
        <h2 className="font-semibold">Issue delegation</h2>
        <ResourceSelect label="Agent" name="agent_id" options={agents} />
        <input name="scopes" required placeholder="relay:call,miser:route" />
        <label className="grid gap-2 text-sm"><span className="label">Expires in seconds</span><input name="expires" type="number" min="60" defaultValue="900" /></label>
        <button className="btn btn-primary" data-testid="delegation-submit">Issue</button>
      </form>

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

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Access policies</h2>
        <button type="button" className="btn btn-primary" data-testid="open-policy-wizard" onClick={() => { setPolicyWizard(true); setPolicyStep(0) }}>Create policy</button>
      </div>

      {policyWizard && (
      <WizardModal
        open={policyWizard}
        title="Create access policy"
        description="A guided, validated workflow. Patroclus remains the enforcement authority."
        steps={['Policy', 'Scope', 'Review']}
        activeStep={policyStep}
        onNext={() => {
          if (policyStep === 0) setSimulation({ action: policyDraft.actions[0] || 'call', resource: policyDraft.resources[0] || '', result: null })
          setPolicyStep((step) => step + 1)
        }}
        onBack={() => setPolicyStep((step) => Math.max(0, step - 1))}
        onFinish={savePolicy}
        canContinue={policyStep === 0 ? policyDraft.name.trim().length >= 3 : policyDraftValid}
        busy={busyAction === 'policy'}
        finishLabel="Save policy"
        onCancel={() => setPolicyWizard(false)}
      >
        <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); if (policyStep < 2) { if (policyStep === 0) setSimulation({ action: policyDraft.actions[0] || 'call', resource: policyDraft.resources[0] || '', result: null }); setPolicyStep(policyStep + 1) } }}>
          <label className="grid gap-2">
            <span className="label">Policy name</span>
            <input data-testid="policy-name" value={policyDraft.name} onChange={(event) => updateRule({ name: event.target.value })} placeholder="allow-github-read" required minLength={3} />
          </label>

          {policyStep >= 1 && (
            <>
              <fieldset className="grid gap-3">
                <legend className="label mb-2">Decision</legend>
                <div className="flex flex-wrap gap-3">
                  {['allow', 'deny'].map((effect) => (
                    <button key={effect} type="button" onClick={() => updateRule({ effect })} className={`btn ${policyDraft.effect === effect ? (effect === 'allow' ? 'btn-primary' : 'btn-danger') : ''}`} data-testid={`policy-effect-${effect}`}>
                      {effect === 'allow' ? 'Allow' : 'Deny'}
                    </button>
                  ))}
                </div>
              </fieldset>

          <label className="grid gap-2">
            <span className="label">Actions</span>
            <input data-testid="policy-actions" value={policyDraft.actions.join(',')} onChange={(event) => updateRule({ actions: event.target.value.split(',').map((item) => item.trim()) })} placeholder="call, read" />
            <span className="text-xs text-[#8d97a6]">Comma separated. Use * only when the intent is intentionally broad.</span>
          </label>

            <label className="grid gap-2">
              <span className="label">Resources</span>
              <input data-testid="policy-resources" value={policyDraft.resources.join(',')} onChange={(event) => updateRule({ resources: event.target.value.split(',').map((item) => item.trim()) })} placeholder="mcp/github/*" />
              <span className="text-xs text-[#8d97a6]">Comma separated resource patterns.</span>
            </label>
          </>
          )}

          {policyStep === 2 && (
          <>
            <label className="grid gap-2"><span className="label">Business reason</span><input data-testid="policy-reason" value={policyDraft.reason} onChange={(event) => updateRule({ reason: event.target.value })} placeholder="Why this exception exists" /></label>

            <div className="inset grid gap-4 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2"><span className="label">Simulate action</span><input data-testid="simulate-action" value={simulation.action} onChange={(event) => setSimulation({ ...simulation, action: event.target.value })} /></label>
                <label className="grid gap-2"><span className="label">Simulate resource</span><input data-testid="simulate-resource" value={simulation.resource} onChange={(event) => setSimulation({ ...simulation, resource: event.target.value })} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn" disabled={!policyDraftValid} onClick={() => runSimulation({ preventDefault() {} })} data-testid="simulate-run">Preview decision</button>
                {!simulation.result && <span className="text-sm text-[#8d97a6]">Preview before saving.</span>}
              </div>
              {simulation.result && (
                <div className={`rounded-xl border p-4 ${simulation.result.decision === 'allow' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`} data-testid="simulation-result">
                  <strong>{String(simulation.result.decision).toUpperCase()}</strong>
                  <p className="mt-1 text-sm">{simulation.result.reason}</p>
                </div>
              )}
            </div>

            <details className="inset rounded-xl p-4" open>
              <summary className="cursor-pointer label">Generated definition</summary>
              <pre className="mt-3 overflow-auto text-xs font-mono text-[#c9d1de]" data-testid="policy-definition">{draftYaml(policyDraft)}</pre>
            </details>
          </>
          )}
        </form>
      </WizardModal>
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
                    <td><button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`inspect-policy-${p.id ?? p.name}`} onClick={() => {
                      const policy = list.find((item) => String(item.id) === String(p.id ?? p.name))
                      setSimulation((current) => ({ ...current, action: current.action, resource: current.resource, result: null }))
                      setMessage({ ok: !!policy, text: policy ? `Policy ${policy.name}` : 'Policy definition unavailable.' })
                    }}>Details</button></td>
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
