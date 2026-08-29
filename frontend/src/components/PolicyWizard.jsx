import { useState } from 'react'
import { useToast, WizardModal } from '../components.jsx'

export default function PolicyWizard({ open, serverName, serverId, onClose, onCreated }) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState({
    name: `allow-${serverName || 'mcp'}`,
    effect: 'allow',
    actions: ['call'],
    resources: [`${serverId || 'mcp/server'}/*`],
    reason: '',
  })
  const [simulation, setSimulation] = useState({ action: draft.actions[0] || 'call', resource: draft.resources[0] || '', result: null })
  const [accessCheck, setAccessCheck] = useState({ principal: 'agt_e2e_001', result: null, busy: false })
  const toast = useToast()

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const valid = draft.name.trim().length >= 3 && draft.actions.some(Boolean) && draft.resources.some(Boolean)

  const yaml = [
    `- name: ${JSON.stringify(draft.name.trim())}`,
    `  actions: ${JSON.stringify(draft.actions.filter(Boolean))}`,
    `  resources: ${JSON.stringify(draft.resources.filter(Boolean))}`,
    `  decision: ${draft.effect}`,
    ...(draft.reason.trim() ? [`  reason: ${JSON.stringify(draft.reason.trim())}`] : []),
  ].join('\n')

  const simulate = async () => {
    const response = await fetch('/api/bff/access/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: simulation.action,
        resource: simulation.resource,
        requested_scopes: [],
        definition: yaml,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setSimulation((current) => ({ ...current, result: response.ok ? body : { decision: 'error', reason: body.error || `status ${response.status}` } }))
  }

  // Authenticated Patroclus check-access against the live policy engine —
  // unlike the draft preview above, this consults the enforcement authority.
  const runAccessCheck = async () => {
    setAccessCheck((current) => ({ ...current, busy: true }))
    try {
      const response = await fetch('/api/bff/access/check-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: accessCheck.principal, action: simulation.action, resource: simulation.resource }),
      })
      const body = await response.json().catch(() => ({}))
      const result = body.result ?? { decision: 'error', reason: body.error || `status ${response.status}` }
      setAccessCheck((current) => ({ ...current, result: { ...result, authority: body.authority ?? 'patroclus' } }))
    } finally {
      setAccessCheck((current) => ({ ...current, busy: false }))
    }
  }

  const save = async () => {
    if (!simulation.result) return
    const response = await fetch('/api/bff/policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: draft.name.trim(), engine: 'yaml', definition: yaml, domain: 'mcp' }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(body.error || 'Policy creation failed.')
      return
    }
    toast.success(`Policy for ${serverName} created.`)
    onClose()
    onCreated?.(body)
  }

  return (
    <WizardModal
      open={open}
      title={`Create policy · ${serverName}`}
      description="Scoped to this MCP server. Patroclus remains the enforcement authority."
      steps={['Decision', 'Scope', 'Review']}
      activeStep={step}
      onNext={() => setStep((current) => current + 1)}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      onFinish={save}
      canContinue={valid}
      finishLabel="Save policy"
      onCancel={onClose}
    >
      {step === 0 && (
        <>
          <label className="grid gap-2">
            <span className="label">Policy name</span>
            <input data-testid="policy-name" value={draft.name} onChange={(event) => update({ name: event.target.value })} />
          </label>
          <fieldset className="grid gap-3">
            <legend className="label">Decision</legend>
            <div className="flex gap-3">
              {['allow', 'deny'].map((effect) => (
                <button key={effect} type="button" onClick={() => update({ effect })} className={`btn ${draft.effect === effect ? (effect === 'allow' ? 'btn-primary' : 'btn-danger') : ''}`} data-testid={`policy-effect-${effect}`}>
                  {effect === 'allow' ? 'Allow' : 'Deny'}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {step === 1 && (
        <>
          <label className="grid gap-2"><span className="label">Actions</span><input data-testid="policy-actions" value={draft.actions.join(',')} onChange={(event) => update({ actions: event.target.value.split(',').map((item) => item.trim()) })} /></label>
          <label className="grid gap-2"><span className="label">Resources</span><input data-testid="policy-resources" value={draft.resources.join(',')} onChange={(event) => update({ resources: event.target.value.split(',').map((item) => item.trim()) })} /></label>
        </>
      )}

      {step === 2 && (
        <>
          <label className="grid gap-2"><span className="label">Business reason</span><input data-testid="policy-reason" value={draft.reason} onChange={(event) => update({ reason: event.target.value })} /></label>
          <div className="inset grid gap-3 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2"><span className="label">Simulate action</span><input data-testid="simulate-action" value={simulation.action} onChange={(event) => setSimulation({ ...simulation, action: event.target.value })} /></label>
              <label className="grid gap-2"><span className="label">Simulate resource</span><input data-testid="simulate-resource" value={simulation.resource} onChange={(event) => setSimulation({ ...simulation, resource: event.target.value })} /></label>
            </div>
            <div><button type="button" className="btn" disabled={!valid} onClick={simulate} data-testid="simulate-run">Preview decision</button></div>
            {simulation.result && (
              <div className={`rounded-xl border p-4 ${simulation.result.decision === 'allow' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`} data-testid="simulation-result">
                <strong>{String(simulation.result.decision).toUpperCase()}</strong>
                <p className="mt-1 text-sm">{simulation.result.reason}</p>
              </div>
            )}
            <div className="rounded-xl border border-[#232833] p-4 grid gap-3">
              <span className="label">Authenticated check · Patroclus live engine</span>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2"><span className="label">Principal</span><input data-testid="check-principal" value={accessCheck.principal} onChange={(event) => setAccessCheck((current) => ({ ...current, principal: event.target.value }))} /></label>
                <div className="flex items-end"><button type="button" className="btn btn-primary !py-1.5" disabled={!valid || accessCheck.busy} onClick={runAccessCheck} data-testid="check-access-run">{accessCheck.busy ? 'Checking…' : 'Run Patroclus check'}</button></div>
              </div>
              {accessCheck.result && (
                <div className={`rounded-xl border p-4 ${accessCheck.result.decision === 'allow' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`} data-testid="check-access-result">
                  <strong>{String(accessCheck.result.decision).toUpperCase()}</strong>
                  <p className="mt-1 text-sm">{accessCheck.result.reason}</p>
                  {accessCheck.result.matched_policy && <p className="mt-1 text-xs font-mono text-slate-400">matched: {accessCheck.result.matched_policy}</p>}
                </div>
              )}
            </div>
          </div>
          <details className="inset rounded-xl p-4" open><summary className="cursor-pointer label">Generated definition</summary><pre className="mt-3 overflow-auto text-xs font-mono text-[#c9d1de]" data-testid="policy-definition">{yaml}</pre></details>
        </>
      )}
    </WizardModal>
  )
}
