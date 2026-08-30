import { useSvc, Panel, Table, Guard, ConfirmDialog } from '../components.jsx'
import { fmtInt } from '../api.js'
import { useState } from 'react'

export default function Security() {
  const { data, error, loading } = useSvc('sentiel', [
    ['stats', '/api/stats'],
    ['dlp', '/api/dlp/violations?limit=20'],
    ['soc2', '/api/compliance/soc2'],
    ['alerts', '/api/alerts'],
    ['integrity', '/api/integrity'],
  ])
  const [message, setMessage] = useState(null)
  const [acknowledged, setAcknowledged] = useState([])
  const [containConfirm, setContainConfirm] = useState(null)

  const acknowledge = async (alertId) => {
    const response = await fetch(`/api/svc/sentiel/api/alerts/${alertId}/acknowledge`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? 'Alert acknowledged.' : body.error || `status ${response.status}` })
    if (response.ok) setAcknowledged((current) => [...current, alertId])
  }

  const verifyAttestation = async () => {
    const agentId = document.querySelector('[data-testid="attestation-agent"]').value
    const processHash = document.querySelector('[data-testid="attestation-hash"]').value
    const response = await fetch('/api/svc/aegis/api/attestation/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, process_hash: processHash || null }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok && body.verified === true, text: response.ok ? (body.verified ? 'Attestation verified.' : 'Attestation failed.') : body.error })
  }

  const checkGeo = async (event) => {
    event.preventDefault()
    const destination = event.currentTarget.elements.destination.value
    const response = await fetch('/api/svc/aegis/api/geo/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ destination }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({
      ok: response.ok && body.allowed === true,
      text: response.ok ? `Geo verdict for ${destination}: ${body.allowed ? 'allowed' : 'blocked'}` : body.error || `status ${response.status}`,
    })
  }

  const containAgent = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setContainConfirm({ agent_id: form.agent_id.value, reason: form.reason.value })
  }

  const performContain = async ({ agent_id: agentId, reason }) => {
    const response = await fetch('/api/bff/risk/contain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, reason }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({
      ok: response.ok && body.contained === true,
      text: response.ok ? `Contained ${agentId}.` : body.error || `status ${response.status}`,
    })
    setContainConfirm(null)
  }

  const createRemediation = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const response = await fetch('/api/bff/risk/remediations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: form.subject.value,
        title: form.title.value,
        owner: form.owner.value,
        status: 'open',
        notes: form.notes.value,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Remediation ${body.id} assigned to ${body.owner}.` : body.error || `status ${response.status}` })
  }

  const stats = data.stats ?? {}
  const dlp = Array.isArray(data.dlp) ? data.dlp : []
  const soc2 = data.soc2 ?? {}

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🔍 Security &amp; Compliance</h1>
        <p className="text-slate-400 mt-1">Sentiel — DLP inspection, anomaly detection, compliance evidence.</p>
      </div>
      <Guard loading={loading} error={error}>
        <div className="grid md:grid-cols-3 gap-4">
          <Panel title="Events ingested"><p className="text-3xl font-bold text-indigo-400">{fmtInt(stats.total_events ?? stats.events)}</p></Panel>
          <Panel title="DLP violations"><p className="text-3xl font-bold text-rose-400">{fmtInt(dlp.length || stats.dlp_violations)}</p></Panel>
          <Panel title="Anomaly alerts"><p className="text-3xl font-bold text-amber-300">{fmtInt(stats.anomaly_alerts ?? stats.alerts)}</p></Panel>
        </div>

        <Panel title="Compliance snapshot" subtitle="Control-mapped summary (SOC 2)">
          <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(soc2.summary ?? soc2, null, 2)}
          </pre>
        </Panel>

        <Panel title="Audit integrity" subtitle="Sentiel event hash-chain status">
          <div className="flex items-center gap-3" data-testid="audit-integrity">
            {data.integrity?.intact ? (
              <span className="badge badge-ok">intact</span>
            ) : (
              <span className="badge badge-crit">broken or unconfigured</span>
            )}
            <span className="text-sm text-slate-400">{fmtInt(data.integrity?.total_events)} events</span>
          </div>
        </Panel>

        <Panel title="Open anomaly alerts" subtitle="Acknowledge after investigation">
          {Array.isArray(data.alerts) && data.alerts.filter((alert) => !acknowledged.includes(alert.id)).length ? data.alerts.filter((alert) => !acknowledged.includes(alert.id)).map((alert) => (
            <div key={alert.id} className="flex items-center gap-2 px-2 py-2 border-b border-slate-800/60">
              <span className="text-sm text-slate-300">{alert.title ?? alert.kind ?? alert.id}</span>
              <button data-testid={`acknowledge-${alert.id}`} className="btn btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => acknowledge(alert.id)}>Acknowledge</button>
            </div>
          )) : <p className="text-sm text-slate-500 py-4">No open alerts.</p>}
        </Panel>

        <Panel title="Agent attestation" subtitle="Verify runtime integrity through Aegis">
          <div className="space-y-2">
            <input data-testid="attestation-agent" placeholder="agent id" />
            <input data-testid="attestation-hash" placeholder="process hash" />
            <button data-testid="verify-attestation" className="btn btn-primary" onClick={verifyAttestation}>Verify</button>
          </div>
        </Panel>

        <Panel title="Data residency check" subtitle="Validate a destination through Aegis geo policy">
          <form className="space-y-2" onSubmit={checkGeo}>
            <input data-testid="geo-destination" name="destination" required placeholder="api.example.test" />
            <button className="btn btn-primary" data-testid="check-geo">Check</button>
          </form>
        </Panel>

        <Panel title="Failed-attestation containment" subtitle="Emergency revoke and emergency stop">
          <form className="space-y-2" onSubmit={containAgent}>
            <input data-testid="contain-agent" name="agent_id" required placeholder="agent id" />
            <input data-testid="contain-reason" name="reason" required placeholder="reason" />
            <button className="btn btn-danger" data-testid="contain-submit">Contain</button>
          </form>
        </Panel>

        <ConfirmDialog
          open={!!containConfirm}
          title="Contain agent"
          message={`Contain ${containConfirm?.agent_id ?? ''}? This revokes the agent identity, kills its sessions, and triggers an emergency stop.`}
          confirmLabel="Contain agent"
          danger
          onConfirm={() => performContain(containConfirm)}
          onCancel={() => setContainConfirm(null)}
        />

        <Panel title="Remediation ownership" subtitle="Assign risk remediation to an accountable owner">
          <form className="space-y-2" onSubmit={createRemediation} data-testid="remediation-form">
            <input name="subject" required placeholder="subject / agent id" />
            <input name="title" required placeholder="action required" />
            <input name="owner" required placeholder="owner email" />
            <textarea name="notes" rows="3" placeholder="notes"></textarea>
            <button className="btn btn-primary" data-testid="remediation-submit">Create</button>
          </form>
        </Panel>

        {message && <div className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</div>}

        <Panel title="Recent DLP violations" subtitle="Pattern-matched secrets & PII caught in flight">
          <Table
            cols={['Time', 'Event', 'Pattern', 'Severity']}
            rows={[...dlp]
              .reverse()
              .slice(0, 20)
              .map((v) => ({
                Time: (v.detected_at ?? v.timestamp ?? '').replace('T', ' ').slice(0, 19),
                Event: (v.event_id ?? '').slice(0, 12),
                Pattern: v.pattern_name,
                Severity: v.severity,
              }))}
            empty="No violations detected — clean traffic."
          />
        </Panel>
      </Guard>
    </div>
  )
}
