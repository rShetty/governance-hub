import { useSvc, Panel, Table, Guard } from '../components.jsx'
import { fmtInt } from '../api.js'

export default function Cost() {
  const { data, error, loading } = useSvc('miser', [
    ['keys', '/admin/keys'],
    ['audit', '/admin/audit/verify'],
  ])

  const keys = Array.isArray(data.keys) ? data.keys : []
  const chain = data.audit ?? {}

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">💸 Cost &amp; Routing</h1>
        <p className="text-slate-400 mt-1">Miser — complexity-tiered routing, per-key budgets, semantic cache.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-3 gap-4">
          <Panel title="API keys"><p className="text-3xl font-bold text-indigo-400">{fmtInt(keys.length)}</p></Panel>
          <Panel title="Active"><p className="text-3xl font-bold text-emerald-400">{keys.filter((k) => k.active).length}</p></Panel>
          <Panel title="Audit chain">
            <p className={`text-sm mt-2 ${chain.valid ? 'text-emerald-400' : 'text-slate-400'}`}>
              {chain.valid != null
                ? `${chain.valid ? '✓ intact' : '✗ broken'} · ${chain.entries ?? 0} entries`
                : '—'}
            </p>
          </Panel>
        </div>

        <Panel title="Keys &amp; quotas" subtitle="Tier allowlists, RPM caps and monthly budgets are enforced at the gateway">
          <Table
            cols={['ID', 'Owner', 'Tiers', 'RPM cap', 'Monthly budget', 'Status']}
            rows={keys.map((k) => ({
              ID: (k.id ?? '').slice(0, 14),
              Owner: k.owner,
              Tiers: (k.allowed_tiers ?? []).join(', ') || 'all',
              'RPM cap': k.rate_limit_rpm ?? '∞',
              'Monthly budget': k.monthly_budget_usd != null ? `$${k.monthly_budget_usd}` : '—',
              Status: k.active ? 'active' : 'inactive',
            }))}
            empty="No API keys provisioned."
          />
        </Panel>
      </Guard>
    </div>
  )
}
