import { useSvc, Panel, Table, Guard } from '../components.jsx'
import { fmtInt } from '../api.js'

export default function Tools() {
  const { data, error, loading } = useSvc('relay', ['/health', '/api/backends'])

  const health = data['/health'] ?? {}
  const backends = Array.isArray(data['/api/backends'])
    ? data['/api/backends']
    : data['/api/backends']?.backends ?? []

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🔌 Tools &amp; MCP</h1>
        <p className="text-slate-400 mt-1">Relay — MCP gateway, connector permissions, consent-gated tool calls.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-3 gap-4">
          <Panel title="Gateway">
            <p className={`text-lg font-semibold ${(health.status ?? '') === 'ok' ? 'text-emerald-400' : 'text-amber-300'}`}>
              {health.status ?? 'unknown'}
            </p>
          </Panel>
          <Panel title="Registered backends"><p className="text-3xl font-bold text-indigo-400">{fmtInt(backends.length)}</p></Panel>
          <Panel title="Circuit breakers"><p className="text-sm text-slate-400 mt-2">Per-backend, auto health-checked</p></Panel>
        </div>

        <Panel title="Backends &amp; connectors">
          <Table
            cols={['ID', 'Type', 'Status', 'Tools']}
            rows={(Array.isArray(backends) ? backends : []).map((b) => ({
              ID: b.id ?? b.backend_id ?? b.name,
              Type: b.type ?? b.backend_type,
              Status: b.status ?? b.circuit_breaker?.state,
              Tools: Array.isArray(b.tools) ? b.tools.length : b.tool_count,
            }))}
            empty="No backends installed."
          />
        </Panel>
      </Guard>
    </div>
  )
}
