import { useEffect, useState } from 'react'
import { svcGet, identities, fmtInt } from '../api.js'
import { PromptDialog, ResourceSelect, useToast, WizardModal } from '../components.jsx'

/**
 * Agents — the unified roster.
 * Left: runtime agents (Hive). Right: machine identities (Argus agt_).
 * One place to see every actor in the ecosystem.
 */
export default function AgentsView() {
  const [hiveErr, setHiveErr] = useState('')
  const [dir, setDir] = useState({ data: null, err: '' })
  const [actionError, setActionError] = useState('')
  const [identityForm, setIdentityForm] = useState({ name: '', scopes: 'relay:call' })
  const [runtimeForm, setRuntimeForm] = useState({ name: '', endpoint_url: '' })
  const toast = useToast()
  const [identityAction, setIdentityAction] = useState(null)
  const [patroclusAction, setPatroclusAction] = useState(null)
  const [healthAction, setHealthAction] = useState(null)
  const [creatorWizard, setCreatorWizard] = useState(null)
  const [creatorStep, setCreatorStep] = useState(0)
  const [runtimeAgents, setRuntimeAgents] = useState([])
  const [actors, setActors] = useState([])

  const loadActors = () => fetch('/api/bff/actors')
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
    .then((data) => setActors(Array.isArray(data.actors) ? data.actors : []))
    .catch(() => setActors([]))

  useEffect(() => {
    const loadRuntime = () => svcGet('hive', '/api/agents?limit=100&order=recent')
      .then((d) => {
        const rows = Array.isArray(d) ? d : d?.items ?? d?.agents ?? []
        setRuntimeAgents(rows)
      })
      .catch((e) => { setHiveErr(String(e.message || e)); setRuntimeAgents([]) })
    loadRuntime()
    loadActors()
    identities()
      .then((d) => setDir({ data: d, err: '' }))
      .catch((e) => setDir({ data: null, err: String(e.message || e) }))
  }, [])

  const runIdentityAction = async (identityId, action, dialogValues) => {
    const { reason } = dialogValues ?? identityAction?.values ?? {}
    if (!reason?.trim()) return
    setActionError('')
    try {
      const response = await fetch(`/api/bff/identities/${encodeURIComponent(identityId)}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      setDir((current) => ({
        ...current,
        data: {
          ...current.data,
          agents: current.data.agents.map((agent) => (
            agent.id === identityId ? { ...agent, status: body.status } : agent
          )),
        },
      }))
      setIdentityAction(null)
    } catch (error) {
      setActionError(String(error.message || error))
    }
  }

  const emergencyKill = async (dialogValues) => {
    const { agent_id: hiveId, reason } = dialogValues ?? patroclusAction?.values ?? {}
    if (!hiveId?.trim() || !reason?.trim()) return
    setActionError('')
    // Selectors use Hive IDs; the emergency action itself targets the
    // correlated Patroclus agent record.
    const patroclusId = actors.find((actor) => actor.hive_id === hiveId)?.patroclus_id || hiveId
    try {
      const response = await fetch(`/api/bff/agents/${encodeURIComponent(patroclusId)}/emergency-kill`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      setActionError(`Emergency stop applied to ${patroclusId} (Hive: ${hiveId}) by ${body.operator}.`)
      setPatroclusAction(null)
    } catch (error) {
      setActionError(String(error.message || error))
    }
  }

  const restoreAgent = async (dialogValues) => {
    const { agent_id: hiveId } = dialogValues ?? patroclusAction?.values ?? {}
    if (!hiveId?.trim()) return
    setActionError('')
    const patroclusId = actors.find((actor) => actor.hive_id === hiveId)?.patroclus_id || hiveId
    try {
      const response = await fetch(`/api/bff/agents/${encodeURIComponent(patroclusId)}/restore`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      setActionError(`Emergency stop cleared for ${patroclusId}. Status: ${body.status}.`)
      setPatroclusAction(null)
    } catch (error) {
      setActionError(String(error.message || error))
    }
  }

  const mintIdentity = async (values) => {
    if (!values?.name?.trim()) return
    setActionError('')
    try {
      const response = await fetch('/api/bff/identities/mint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          scopes: values.scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      setActionError(`Identity ${body.agent_id} minted. Retrieve the one-time secret from the secure operator channel.`)
      setCreatorWizard(null)
      loadActors()
    } catch (error) {
      setActionError(String(error.message || error))
    }
  }

  const createRuntimeAgent = async () => {
    if (!runtimeForm.name.trim() || !runtimeForm.endpoint_url.trim()) return
    setActionError('')
    try {
      const response = await fetch('/api/bff/runtime-agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...runtimeForm, description: 'Created from Governance Hub' }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      const agentId = body.agent_id ?? body.id
      setRuntimeAgents((current) => [...current, {
        id: agentId,
        agent_id: agentId,
        name: runtimeForm.name,
        status: 'active',
      }])
      setActionError(`Runtime agent ${body.agent_id ?? body.id ?? runtimeForm.name} registered.`)
      setRuntimeForm({ name: '', endpoint_url: '' })
      setCreatorWizard(null)
      loadActors()
    } catch (error) {
      setActionError(String(error.message || error))
    }
  }

  const checkRuntimeHealth = async (agentId) => {
    if (!agentId?.trim()) return
    const response = await fetch(`/api/bff/runtime-agents/${encodeURIComponent(agentId)}/health`)
    const body = await response.json().catch(() => ({}))
      setActionError(response.ok ? `Health checked ${agentId}: ${body.status ?? 'ok'}` : body.error || `status ${response.status}`)
      setHealthAction(null)
  }

  const sortedRuntimeAgents = [...runtimeAgents].sort(
    (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  )
  const agents = Array.isArray(dir.data?.agents) ? dir.data.agents : []

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="h-display text-2xl">Agents</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Runtime actors (Hive) and their ecosystem identities (Argus) — one roster.
          </p>
          <button className="btn btn-danger" onClick={() => setPatroclusAction({ kind: 'kill', values: {} })}>Emergency stop</button>
          <button className="btn" data-testid="agent-restore-btn" onClick={() => setPatroclusAction({ kind: 'restore', values: {} })}>Restore agent</button>
          <button className="btn" onClick={() => setHealthAction({ values: {} })}>Check runtime agent health</button>
        </div>
      </div>

      {identityAction && (
        <PromptDialog
          open
          title={`${identityAction.action} identity`}
          description={`Identity ${identityAction.id} requires a recorded reason.`}
          fields={[{ name: 'reason', label: 'Required reason', textarea: true }]}
          submitLabel={identityAction.action === 'revoke' ? 'Revoke identity' : 'Restore identity'}
          onSubmit={(values) => runIdentityAction(identityAction.id, identityAction.action, values)}
          onCancel={() => setIdentityAction(null)}
        />
      )}

      {patroclusAction && (
        <PromptDialog
          open
          title={patroclusAction.kind === 'kill' ? 'Emergency stop' : 'Clear emergency stop'}
          description="The action applies across Patroclus and is attributed to your session."
          fields={[
            { name: 'agent_id', label: 'Runtime agent', type: 'select', options: sortedRuntimeAgents.map(({ id, agent_id, name }) => ({ id: id ?? agent_id, name: name ?? id ?? agent_id })) },
            ...(patroclusAction.kind === 'kill' ? [{ name: 'reason', label: 'Required reason', textarea: true }] : []),
          ]}
          submitLabel={patroclusAction.kind === 'kill' ? 'Apply stop' : 'Clear stop'}
          onSubmit={(values) => patroclusAction.kind === 'kill' ? emergencyKill(values) : restoreAgent(values)}
          onCancel={() => setPatroclusAction(null)}
        />
      )}

      {healthAction && (
        <PromptDialog
          open
          title="Check runtime agent health"
          fields={[{ name: 'agent_id', label: 'Runtime agent', type: 'select', options: sortedRuntimeAgents.map(({ id, agent_id, name }) => ({ id: id ?? agent_id, name: name ?? id ?? agent_id })) }]}
          submitLabel="Check health"
          onSubmit={(values) => checkRuntimeHealth(values.agent_id)}
          onCancel={() => setHealthAction(null)}
        />
      )}

      {creatorWizard === 'runtime' && (
        <WizardModal
          open
          title="Register runtime agent"
          description="Connect a Hive runtime to the governance control plane."
          steps={['Identity', 'Endpoint']}
          activeStep={creatorStep}
          onNext={() => setCreatorStep((step) => Math.min(step + 1, 2))}
          onBack={() => setCreatorStep((step) => Math.max(0, step - 1))}
          onFinish={createRuntimeAgent}
          canContinue={creatorStep === 0 ? !!runtimeForm.name : true}
          finishLabel="Register agent"
          onCancel={() => setCreatorWizard(null)}
        >
          <label className="grid gap-2"><span className="label">Agent name</span><input data-testid="runtime-name" required value={runtimeForm.name} onChange={(event) => setRuntimeForm({ ...runtimeForm, name: event.target.value })} /></label>
            {creatorStep >= 1 && <label className="grid gap-2"><span className="label">Endpoint URL</span><input data-testid="runtime-endpoint" type="url" required value={runtimeForm.endpoint_url} onChange={(event) => setRuntimeForm({ ...runtimeForm, endpoint_url: event.target.value })} /></label>}
            {creatorStep === 1 && <p className="text-sm text-[#c9d1de]">The agent is registered in Hive and appears immediately in the runtime roster.</p>}
        </WizardModal>
      )}

      {creatorWizard === 'identity' && (
        <PromptDialog
          open
          title="Mint machine identity"
          description="Creates a scoped Argus identity. The one-time secret stays backend-only."
          fields={[
            { name: 'name', label: 'Identity name', value: identityForm.name },
            { name: 'scopes', label: 'Scopes', value: identityForm.scopes },
          ]}
          submitLabel="Mint identity"
          onSubmit={(values) => {
            mintIdentity(values)
          }}
          onCancel={() => setCreatorWizard(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Create</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => { setCreatorWizard('runtime'); setCreatorStep(0) }} data-testid="open-runtime-wizard">Runtime agent</button>
          <button className="btn btn-primary" onClick={() => setCreatorWizard('identity')} data-testid="open-identity-dialog">Machine identity</button>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Runtime agents — Hive */}
        <section className="panel overflow-hidden" data-testid="runtime-agents">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Runtime · Hive</span>
            <span className="num text-[11px] text-slate-600">{fmtInt(runtimeAgents.length)}</span>
          </div>
          {hiveErr && <div className="p-4 text-[13px] text-amber-400/90">Hive unavailable — {hiveErr}</div>}
          {!hiveErr && !runtimeAgents.length && <div className="p-4 text-sm text-slate-600">No runtime agents yet.</div>}
          {runtimeAgents.length > 0 && (
            <table className="data">
              <thead><tr><th>Agent</th><th>Status</th></tr></thead>
              <tbody>
                {runtimeAgents.slice(0, 12).map((a) => (
                  <tr key={a.id ?? a.agent_id}>
                    <td className="text-slate-200">{a.name ?? a.slug ?? a.id}</td>
                    <td><span className={`badge ${a.status === 'active' ? 'badge-ok' : 'badge-warn'}`}>{a.status ?? 'unknown'}</span></td>
                  </tr>
                ))}
                {!runtimeAgents.length && (
                  <tr><td colSpan="2" className="text-center py-8 text-slate-600">No runtime agents registered</td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        {/* Machine identities — Argus */}
        <section className="panel overflow-hidden" data-testid="machine-identities">
          <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
            <span className="label">Identities · Argus</span>
            <span className="num text-[11px] text-slate-600">{fmtInt(agents.length)}</span>
          </div>
          {dir.err && <div className="p-4 text-[13px] text-amber-400/90">Argus directory needs admin session — {dir.err}</div>}
          {!dir.err && !dir.data && <div className="p-4 text-sm text-slate-600">Loading…</div>}
          {dir.data && (
            <table className="data">
              <thead><tr><th>Identity</th><th>Scopes</th><th>Kill switch</th></tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} data-testid={`identity-${a.id}`}>
                    <td className="text-slate-200 font-mono text-xs">{a.name}<div className="text-slate-600 text-[10px]">{a.owner}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(a.scopes || []).map((s) => <span key={s} className="badge badge-mono !text-[10px]">{s}</span>)}
                      </div>
                    </td>
                    <td>{a.status === 'active'
                      ? <span className="badge badge-ok">armed</span>
                      : <span className="badge badge-crit">revoked</span>}</td>
                    <td>
                      {a.status === 'active' ? (
                        <button data-testid={`identity-revoke-${a.id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => setIdentityAction({ id: a.id, action: 'revoke', values: {} })}>Revoke</button>
                      ) : (
                        <button data-testid={`identity-restore-${a.id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => setIdentityAction({ id: a.id, action: 'restore', values: {} })}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!agents.length && (
                  <tr><td colSpan="4" className="text-center py-8 text-slate-600">
                    No agent identities yet.<br />
                    <span className="text-slate-700 text-xs">Create via Argus POST /api/agents — P2 adds this to this view.</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel overflow-hidden" data-testid="unified-actors">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Unified actors · Hive + Argus + Patroclus</span>
          <span className="num text-[11px] text-slate-600">{fmtInt(actors.length)}</span>
        </div>
        <table className="data">
          <thead><tr><th>Actor</th><th>Hive ID</th><th>Argus ID</th><th>Patroclus ID</th></tr></thead>
          <tbody>
            {actors.map((actor) => (
              <tr key={actor.hive_id ?? actor.argus_id ?? actor.name} data-testid={`actor-row-${actor.name}`}>
                <td className="text-slate-200">{actor.name}</td>
                <td className="font-mono text-[11px] text-slate-400">{actor.hive_id ?? '—'}</td>
                <td className="font-mono text-[11px] text-slate-400">{actor.argus_id ?? '—'}</td>
                <td className="font-mono text-[11px] text-slate-400">{actor.patroclus_id ?? '—'}</td>
              </tr>
            ))}
            {!actors.length && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-600">No correlated actors yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {actionError && <div className="panel p-4 text-sm text-slate-200" data-testid="identity-action-result">{actionError}</div>}
    </div>
  )
}
