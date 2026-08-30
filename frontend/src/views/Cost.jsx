import { useEffect, useState } from 'react'
import { Modal, ConfirmDialog, usePagination, PaginationControls } from '../components.jsx'

export default function Cost() {
  const [state, setState] = useState({ data: null, err: '' })
  const [form, setForm] = useState({ owner: '', client: '', rate_limit_rpm: '', monthly_budget_usd: '', allowed_tiers: '', expires: '' })
  const [message, setMessage] = useState(null)
  const [quota, setQuota] = useState({ keyId: '', client: '', rpm: '60', budget: '25' })
  const [health, setHealth] = useState(null)
  const [usage, setUsage] = useState(null)
  const [usageWindow, setUsageWindow] = useState('30d')
  const [dialog, setDialog] = useState(null) // 'create' | 'quota' | null
  const [revokeTarget, setRevokeTarget] = useState(null)

  useEffect(() => {
    fetch('/api/bff/cost')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setState({ data: d, err: '' }))
      .catch((e) => setState({ data: null, err: String(e.message || e) }))
    fetch('/api/bff/cost/health')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then(setHealth)
      .catch(() => setHealth({ audit: { valid: false } }))
  }, [])

  useEffect(() => {
    fetch(`/api/bff/cost/usage?window=${usageWindow}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setUsage(d))
      .catch(() => setUsage(null))
  }, [usageWindow])

  const refreshKeys = async () => {
    const refreshed = await fetch('/api/bff/cost')
    if (refreshed.ok) setState({ data: await refreshed.json(), err: '' })
  }

  const createKey = async (event) => {
    event.preventDefault()
    const response = await fetch('/api/bff/cost/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: form.owner,
        client: form.client || null,
        allowed_tiers: form.allowed_tiers.split(',').map((tier) => tier.trim()).filter(Boolean),
        rate_limit_rpm: form.rate_limit_rpm ? Number(form.rate_limit_rpm) : null,
        monthly_budget_usd: form.monthly_budget_usd ? Number(form.monthly_budget_usd) : null,
        expires_at: form.expires ? Math.floor(Date.parse(form.expires) / 1000) : null,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Key provisioned. Retrieve the one-time secret from the secure operator command output.' : body.error })
    if (response.ok) {
      setForm({ owner: '', client: '', rate_limit_rpm: '', monthly_budget_usd: '', allowed_tiers: '', expires: '' })
      setDialog(null)
      await refreshKeys()
    }
  }

  const revokeKey = async (keyId) => {
    const response = await fetch(`/api/bff/cost/keys/${keyId}/revoke`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Key revoked.' : body.error })
    setRevokeTarget(null)
    if (response.ok) await refreshKeys()
  }

  const updateQuota = async (event) => {
    event.preventDefault()
    const response = await fetch(`/api/bff/cost/keys/${encodeURIComponent(quota.keyId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client: quota.client || null,
        allowed_tiers: quota.tiers ? quota.tiers.split(',').map((tier) => tier.trim()).filter(Boolean) : [],
        rate_limit_rpm: quota.rpm ? Number(quota.rpm) : null,
        monthly_budget_usd: quota.budget ? Number(quota.budget) : null,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Quotas updated for ${quota.keyId}.` : body.error || `status ${response.status}` })
    if (response.ok) setDialog(null)
  }

  const keys = Array.isArray(state.data?.keys) ? state.data.keys : []
  const keyPage = usePagination(keys, 20)
  const totalSpend = keys.reduce((sum, key) => sum + Number(key.spend_total_usd ?? key.spend ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Cost &amp; Routing</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Miser gateway — tier routing, budgets and API keys per principal.
        </p>
      </div>
      {state.err && <div className="panel p-4 text-[13px] text-amber-400/90">Miser unavailable — {state.err}</div>}
      {state.data?.configured === false && (
        <div className="panel p-8 text-center text-[13px] text-slate-500">
          Miser admin integration not configured on this deployment. Set <code className="text-slate-400">MISER_ADMIN_KEY</code> in the hub environment to enable spend visibility.
        </div>
      )}
      {state.data?.configured !== false && (
      <section className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Provisioned keys</span>
          <span className="num text-[11px] text-slate-600">{keys.length}</span>
        </div>
        <table className="data">
          <thead><tr><th>Key</th><th>Owner</th><th>Client</th><th>Quotas</th><th>30d usage</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {keyPage.pageItems.map((k) => {
              const usage30 = k.usage_30d ?? {}
              return (
              <tr key={k.id ?? k.key_id} data-testid={`miser-key-${k.id ?? k.key_id}`}>
                <td className="text-slate-200 font-mono text-xs">{k.name ?? k.key_id}</td>
                <td className="text-slate-500">{k.owner ?? '—'}</td>
                <td><span className="badge badge-mono !text-[10px]">{k.client && k.client !== '-' ? k.client : '—'}</span></td>
                <td>
                  <span className="badge badge-mono !text-[10px]">{(k.allowed_tiers ?? []).join(', ') || 'all tiers'}</span>
                  <div className="text-xs text-slate-500">{k.rate_limit_rpm ?? '∞'} RPM · ${(k.monthly_budget_usd ?? 0).toFixed(2)}</div>
                </td>
                <td className="num text-xs text-slate-300">
                  {usage30.requests != null
                    ? <>{usage30.requests} req · {Number(usage30.prompt_tokens ?? 0) + Number(usage30.completion_tokens ?? 0)} tok · ${Number(usage30.cost_usd ?? 0).toFixed(2)}</>
                    : `$${Number(k.spend_total_usd ?? k.spend ?? 0).toFixed(4)}`}
                </td>
                <td className="num text-xs text-slate-500">{k.expires_at ? new Date(k.expires_at * 1000).toISOString().slice(0, 10) : 'never'}</td>
                <td><span className={`badge ${k.active === false ? 'badge-crit' : 'badge-ok'}`}>{k.active === false ? 'revoked' : 'active'}</span></td>
                <td>{k.active === false ? '—' : <button data-testid={`miser-revoke-${k.id ?? k.key_id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => setRevokeTarget(k.id ?? k.key_id)}>Revoke</button>}</td>
              </tr>
              )
            })}
            {!keys.length && !state.err && (
              <tr><td colSpan="8" className="text-center py-8 text-slate-600">
                No API keys yet — keys provisioned via the Miser API appear here with their spend attribution.
              </td></tr>
            )}
          </tbody>
        </table>
        <PaginationControls testIdPrefix="miser-keys" page={keyPage.page} totalPages={keyPage.totalPages} total={keyPage.total} singular="key" plural="keys" onPageChange={keyPage.setPage} />
      </section>
      )}
      {health && (
        <div className="grid md:grid-cols-3 gap-6">
          <section className="panel p-5" data-testid="miser-audit">
            <span className="label">Audit chain</span>
            <p className={`mt-2 text-sm ${health.audit?.valid ? 'text-emerald-400' : 'text-rose-400'}`}>{health.audit?.valid ? `intact · ${health.audit.entries ?? 0} entries` : health.audit?.error || 'invalid or unavailable'}</p>
          </section>
          <section className="panel p-5" data-testid="miser-cache">
            <span className="label">Cache</span>
            <p className="mt-2 text-sm text-emerald-400">{health.cache?.status}</p>
          </section>
          <section className="panel p-5" data-testid="miser-providers">
            <span className="label">Providers</span>
            {health.providers.map((provider) => (
              <p key={provider.name} className="mt-2 flex justify-between text-sm"><span>{provider.name}</span><span className={provider.status === 'healthy' ? 'text-emerald-400' : 'text-amber-300'}>{provider.status}</span></p>
            ))}
          </section>
        </div>
      )}
      <div className="panel p-5" data-testid="spend-attribution">
        <span className="label">Spend attribution</span>
        <p className="mt-2 num text-2xl text-teal-300">${totalSpend.toFixed(4)}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" data-testid="miser-open-create" onClick={() => setDialog('create')}>Provision key</button>
        <button type="button" className="btn" data-testid="miser-open-quota" onClick={() => setDialog('quota')}>Update quotas</button>
      </div>
      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'}>{message.text}</div>}
      {usage && (
        <section className="panel p-5 space-y-4" data-testid="usage-panel">
          <div className="flex items-center justify-between">
            <span className="label">LLM usage — {usageWindow}</span>
            <div className="flex gap-1">
              {['24h', '7d', '30d', 'all'].map((w) => (
                <button
                  key={w}
                  type="button"
                  data-testid={`usage-window-${w}`}
                  onClick={() => setUsageWindow(w)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] border ${usageWindow === w ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : 'border-[#232833] text-slate-500 hover:text-slate-300'}`}
                >{w}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="usage-summary">
            <div className="glass p-4"><div className="num text-2xl text-indigo-300">{usage.requests ?? 0}</div><div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">Requests</div></div>
            <div className="glass p-4"><div className="num text-2xl text-cyan-300">{(Number(usage.prompt_tokens ?? 0) + Number(usage.completion_tokens ?? 0)).toLocaleString()}</div><div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">Tokens</div></div>
            <div className="glass p-4"><div className="num text-2xl text-teal-300">${Number(usage.cost_usd ?? 0).toFixed(2)}</div><div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">Spend</div></div>
            <div className="glass p-4"><div className="num text-2xl text-slate-200">{Object.keys(usage.by_client ?? {}).length}</div><div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">Clients</div></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <span className="label">By client</span>
              <table className="data" data-testid="usage-clients">
                <thead><tr><th>Client</th><th>Requests</th><th>Tokens</th><th>Spend</th></tr></thead>
                <tbody>
                  {Object.entries(usage.by_client ?? {}).map(([client, agg]) => (
                    <tr key={client}>
                      <td className="text-slate-200">{client}</td>
                      <td className="num">{agg.requests}</td>
                      <td className="num">{(Number(agg.prompt_tokens ?? 0) + Number(agg.completion_tokens ?? 0)).toLocaleString()}</td>
                      <td className="num">${Number(agg.cost_usd ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {!Object.keys(usage.by_client ?? {}).length && (
                    <tr><td colSpan="4" className="text-center py-4 text-slate-600">No attributed usage in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <span className="label">By model</span>
              <table className="data" data-testid="usage-models">
                <thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Spend</th></tr></thead>
                <tbody>
                  {Object.entries(usage.by_model ?? {}).map(([model, agg]) => (
                    <tr key={model}>
                      <td className="text-slate-200 font-mono text-xs">{model}</td>
                      <td className="num">{agg.requests}</td>
                      <td className="num">{(Number(agg.prompt_tokens ?? 0) + Number(agg.completion_tokens ?? 0)).toLocaleString()}</td>
                      <td className="num">${Number(agg.cost_usd ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {!Object.keys(usage.by_model ?? {}).length && (
                    <tr><td colSpan="4" className="text-center py-4 text-slate-600">No model usage in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      <Modal open={dialog === 'create'} title="Provision Miser key" description="Keys route traffic through the Miser gateway with per-principal quotas." onClose={() => setDialog(null)}>
        <form onSubmit={createKey} className="grid gap-4" data-testid="miser-key-form">
          <input data-testid="miser-owner" required placeholder="owner" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
          <input data-testid="miser-client" placeholder="client / app label (for attribution)" value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} />
          <input data-testid="miser-rpm" placeholder="requests per minute" value={form.rate_limit_rpm} onChange={(event) => setForm({ ...form, rate_limit_rpm: event.target.value })} />
          <input data-testid="miser-budget" placeholder="monthly budget USD" value={form.monthly_budget_usd} onChange={(event) => setForm({ ...form, monthly_budget_usd: event.target.value })} />
          <input data-testid="miser-tiers" placeholder="allowed tiers (simple, hard)" value={form.allowed_tiers} onChange={(event) => setForm({ ...form, allowed_tiers: event.target.value })} />
          <input data-testid="miser-expires" type="date" value={form.expires} onChange={(event) => setForm({ ...form, expires: event.target.value })} />
          <button data-testid="miser-create" className="btn btn-primary">Provision</button>
        </form>
      </Modal>
      <Modal open={dialog === 'quota'} title="Quotas and budget" description="Update rate and budget enforcement for an existing key." onClose={() => setDialog(null)}>
        <form className="grid gap-4" data-testid="miser-quota-form" onSubmit={updateQuota}>
          <input data-testid="quota-key" required placeholder="key id" value={quota.keyId} onChange={(event) => setQuota({ ...quota, keyId: event.target.value })} />
          <input data-testid="quota-client" placeholder="client / app label" value={quota.client ?? ''} onChange={(event) => setQuota({ ...quota, client: event.target.value })} />
          <input data-testid="quota-rpm" placeholder="requests per minute" value={quota.rpm} onChange={(event) => setQuota({ ...quota, rpm: event.target.value })} />
          <input data-testid="quota-budget" placeholder="monthly budget USD" value={quota.budget} onChange={(event) => setQuota({ ...quota, budget: event.target.value })} />
          <input data-testid="quota-tiers" placeholder="allowed tiers" value={quota.tiers ?? ''} onChange={(event) => setQuota({ ...quota, tiers: event.target.value })} />
          <button className="btn btn-primary" data-testid="quota-submit">Update</button>
          <p className="text-xs text-slate-500">
            Enforcement preview: at ${Number(quota.budget || 0).toFixed(2)} monthly and {quota.rpm || 0} RPM, the key is blocked after the budget is exhausted or the per-minute limit is reached.
          </p>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke Miser key"
        message={`Revoke key ${revokeTarget ?? ''}? Client traffic authenticated with this key will fail immediately.`}
        confirmLabel="Revoke key"
        danger
        onConfirm={() => revokeKey(revokeTarget)}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
