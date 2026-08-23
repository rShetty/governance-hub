import { useEffect, useState } from 'react'

export default function Cost() {
  const [state, setState] = useState({ data: null, err: '' })
  const [form, setForm] = useState({ owner: '', rate_limit_rpm: '', monthly_budget_usd: '' })
  const [message, setMessage] = useState(null)
  const [quota, setQuota] = useState({ keyId: '', rpm: '60', budget: '25' })

  useEffect(() => {
    fetch('/api/bff/cost')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d) => setState({ data: d, err: '' }))
      .catch((e) => setState({ data: null, err: String(e.message || e) }))
  }, [])

  const createKey = async (event) => {
    event.preventDefault()
    const response = await fetch('/api/bff/cost/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        owner: form.owner,
        allowed_tiers: [],
        rate_limit_rpm: form.rate_limit_rpm ? Number(form.rate_limit_rpm) : null,
        monthly_budget_usd: form.monthly_budget_usd ? Number(form.monthly_budget_usd) : null,
        expires_at: null,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Key provisioned. Retrieve the one-time secret from the secure operator command output.' : body.error })
    if (response.ok) {
      setForm({ owner: '', rate_limit_rpm: '', monthly_budget_usd: '' })
      const refreshed = await fetch('/api/bff/cost')
      if (refreshed.ok) setState({ data: await refreshed.json(), err: '' })
    }
  }

  const revokeKey = async (keyId) => {
    if (!window.confirm(`Revoke key ${keyId}?`)) return
    const response = await fetch(`/api/bff/cost/keys/${keyId}/revoke`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Key revoked.' : body.error })
    if (response.ok) {
      const refreshed = await fetch('/api/bff/cost')
      if (refreshed.ok) setState({ data: await refreshed.json(), err: '' })
    }
  }

  const updateQuota = async (event) => {
    event.preventDefault()
    const response = await fetch(`/api/bff/cost/keys/${encodeURIComponent(quota.keyId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        allowed_tiers: [],
        rate_limit_rpm: quota.rpm ? Number(quota.rpm) : null,
        monthly_budget_usd: quota.budget ? Number(quota.budget) : null,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Quotas updated for ${quota.keyId}.` : body.error || `status ${response.status}` })
  }

  const keys = Array.isArray(state.data?.keys) ? state.data.keys : []

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
          <thead><tr><th>Key</th><th>Owner</th><th>Tier</th><th>Status</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id ?? k.key_id} data-testid={`miser-key-${k.id ?? k.key_id}`}>
                <td className="text-slate-200 font-mono text-xs">{k.name ?? k.key_id}</td>
                <td className="text-slate-500">{k.owner ?? '—'}</td>
                <td><span className="badge badge-mono !text-[10px]">{k.tier ?? 'standard'}</span></td>
                <td><span className={`badge ${k.active === false ? 'badge-crit' : 'badge-ok'}`}>{k.active === false ? 'revoked' : 'active'}</span></td>
                <td>{k.active === false ? '—' : <button data-testid={`miser-revoke-${k.id ?? k.key_id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => revokeKey(k.id ?? k.key_id)}>Revoke</button>}</td>
              </tr>
            ))}
            {!keys.length && !state.err && (
              <tr><td colSpan="4" className="text-center py-8 text-slate-600">
                No API keys yet — keys provisioned via the Miser API appear here with their spend attribution.
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
      )}
      <form onSubmit={createKey} className="panel p-5 space-y-3" data-testid="miser-key-form">
        <h2 className="font-semibold">Provision key</h2>
        <input data-testid="miser-owner" required placeholder="owner" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} />
        <input data-testid="miser-rpm" placeholder="requests per minute" value={form.rate_limit_rpm} onChange={(event) => setForm({ ...form, rate_limit_rpm: event.target.value })} />
        <input data-testid="miser-budget" placeholder="monthly budget USD" value={form.monthly_budget_usd} onChange={(event) => setForm({ ...form, monthly_budget_usd: event.target.value })} />
        <button data-testid="miser-create" className="btn btn-primary">Provision</button>
      </form>
      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'}>{message.text}</div>}
      <form className="panel p-5 space-y-3" data-testid="miser-quota-form" onSubmit={updateQuota}>
        <h2 className="font-semibold">Quotas and budget</h2>
        <input data-testid="quota-key" required placeholder="key id" value={quota.keyId} onChange={(event) => setQuota({ ...quota, keyId: event.target.value })} />
        <input data-testid="quota-rpm" placeholder="requests per minute" value={quota.rpm} onChange={(event) => setQuota({ ...quota, rpm: event.target.value })} />
        <input data-testid="quota-budget" placeholder="monthly budget USD" value={quota.budget} onChange={(event) => setQuota({ ...quota, budget: event.target.value })} />
        <button className="btn btn-primary" data-testid="quota-submit">Update</button>
        <p className="text-xs text-slate-500">
          Enforcement preview: at ${Number(quota.budget || 0).toFixed(2)} monthly and {quota.rpm || 0} RPM, the key is blocked after the budget is exhausted or the per-minute limit is reached.
        </p>
      </form>
    </div>
  )
}
