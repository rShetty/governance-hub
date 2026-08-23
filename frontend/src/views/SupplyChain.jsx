import { useEffect, useState } from 'react'

const BLANK_PACKAGE = {
  name: '',
  version: '',
  publisher: '',
  file_path: '',
}
const BLANK_PUBLISHER = {
  publisher: '',
  public_key: '',
  trust_level: '1',
}

export default function SupplyChain() {
  const [packages, setPackages] = useState(null)
  const [publishers, setPublishers] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [packageForm, setPackageForm] = useState(BLANK_PACKAGE)
  const [publisherForm, setPublisherForm] = useState(BLANK_PUBLISHER)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [associations, setAssociations] = useState([])
  const [signingKey, setSigningKey] = useState(null)
  const [verification, setVerification] = useState(null)

  const openDetail = async (item) => {
    setSelected(item.id)
    setDetail(null)
    try {
      const response = await fetch(`/api/svc/forge/api/packages/${item.id}/trust`)
      if (!response.ok) throw new Error(`status ${response.status}`)
      setDetail(await response.json())
    } catch (cause) {
      setMessage({ ok: false, text: String(cause.message || cause) })
    }
  }

  const runPackageAction = async (action) => {
    if (!selected) return
    setBusy(true)
    try {
      let response
      if (action === 'sbom') {
        response = await fetch(`/api/svc/forge/api/packages/${selected}/sbom`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dependencies: [] }),
        })
      } else if (action === 'scan') {
        response = await fetch(`/api/svc/forge/api/packages/${selected}/scan`, { method: 'POST' })
      } else if (action === 'verify') {
        response = await fetch(`/api/svc/forge/api/packages/${selected}/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ public_key: signingKey?.public_key ?? '' }),
        })
        const body = await response.json().catch(() => ({}))
        setVerification(body)
      } else if (action === 'sign') {
        if (!signingKey?.private_key) throw new Error('Generate a signing key first')
        response = await fetch(`/api/svc/forge/api/packages/${selected}/sign`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ private_key: signingKey.private_key }),
        })
      } else if (action === 'provenance') {
        response = await fetch(`/api/svc/forge/api/packages/${selected}/provenance`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            builder: 'governance-hub',
            source_repo: 'https://example.test/repo',
            commit_hash: 'e2e0000000000000000000000000000000000000',
            branch: 'main',
            materials: [],
          }),
        })
      }
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `status ${response.status}`)
      setMessage({ ok: true, text: `${action} completed.` })
      await openDetail({ id: selected })
    } catch (cause) {
      setMessage({ ok: false, text: String(cause.message || cause) })
    } finally {
      setBusy(false)
    }
  }

  const associateAgent = async (event) => {
    event.preventDefault()
    if (!selected) return
    const agentId = event.currentTarget.elements.agent_id.value
    const response = await fetch(`/api/svc/forge/api/packages/${selected}/agents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, operator: 'governance-hub-operator' }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage({ ok: response.ok, text: response.ok ? `Associated with ${agentId}.` : body.error || `status ${response.status}` })
  }

  const loadAssociations = async () => {
    if (!selected) return
    try {
      const response = await fetch(`/api/svc/forge/api/packages/${selected}/agents`)
      if (!response.ok) throw new Error(`status ${response.status}`)
      setAssociations(await response.json())
    } catch (cause) {
      setAssociations([])
      setMessage({ ok: false, text: String(cause.message || cause) })
    }
  }

  const generateKey = async () => {
    try {
      const response = await fetch('/api/svc/forge/api/keys/generate', { method: 'POST' })
      if (!response.ok) throw new Error(`status ${response.status}`)
      setSigningKey(await response.json())
      setMessage({ ok: true, text: 'Signing key generated. Keep the private key secure.' })
    } catch (cause) {
      setMessage({ ok: false, text: String(cause.message || cause) })
    }
  }

  useEffect(() => { loadAssociations() }, [selected, message])

  const load = () => {
    Promise.all([
      fetch('/api/svc/forge/api/packages'),
      fetch('/api/svc/forge/api/publishers'),
    ]).then(async ([packageResponse, publisherResponse]) => {
      if (!packageResponse.ok || !publisherResponse.ok) throw new Error('Forge unavailable')
      const packageBody = await packageResponse.json()
      const publisherBody = await publisherResponse.json()
      setPackages(Array.isArray(packageBody) ? packageBody : packageBody.packages ?? [])
      setPublishers(Array.isArray(publisherBody) ? publisherBody : publisherBody.publishers ?? [])
      setError('')
    }).catch((cause) => {
      setPackages([])
      setError(String(cause.message || cause))
    })
  }

  useEffect(load, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  const submit = async (path, body) => {
    setBusy(true)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `status ${response.status}`)
      setMessage({ ok: true, text: path.includes('publishers') ? 'Publisher trusted.' : 'Package registered.' })
      setPackageForm(BLANK_PACKAGE)
      setPublisherForm(BLANK_PUBLISHER)
      load()
    } catch (cause) {
      setMessage({ ok: false, text: String(cause.message || cause) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Supply Chain</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Forge-backed package trust before an agent or tool becomes deployable.
        </p>
      </div>

      {error && <div className="panel p-4 text-sm text-amber-300">Forge unavailable — {error}</div>}

      <section className="panel overflow-hidden" data-testid="supply-packages">
        <div className="px-4 py-3 border-b border-[#232833] flex items-center justify-between">
          <span className="label">Packages</span>
          <span className="num text-xs text-slate-600">{packages?.length ?? 0}</span>
        </div>
        {!packages && <div className="p-4 text-sm text-slate-600">Loading packages…</div>}
        {packages && !packages.length && (
          <div className="p-8 text-center text-sm text-slate-600" data-testid="supply-empty">
            No packages registered.
          </div>
        )}
        {packages?.length > 0 && (
          <table className="data">
            <thead><tr><th>Package</th><th>Publisher</th><th>Status</th></tr></thead>
            <tbody>
              {packages.map((item) => (
                <tr key={item.id} data-testid={`supply-package-${item.id}`}>
                  <td className="text-slate-200">{item.name}<div className="text-xs text-slate-600">{item.version}</div></td>
                  <td className="text-slate-400">{item.publisher}</td>
                  <td><span className={`badge ${item.signature ? 'badge-ok' : 'badge-warn'}`}>{item.signature ? 'signed' : 'unsigned'}</span></td>
                  <td><button className="btn btn-ghost !py-1 !px-2 !text-[11px]" data-testid={`trust-${item.id}`} onClick={() => openDetail(item)}>Trust</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <section className="panel p-5 space-y-3" data-testid="package-trust">
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={busy} onClick={() => runPackageAction('sbom')}>Generate SBOM</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => runPackageAction('scan')}>Scan</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => runPackageAction('provenance')}>Set provenance</button>
          </div>
          {!detail ? <p className="text-sm text-slate-600">Loading trust…</p> : (
            <>
              <div className="flex items-center gap-3" data-testid="release-decision">
                {detail.has_critical || detail.factors?.has_critical ? (
                  <span className="badge badge-crit">blocked: critical vulnerability</span>
                ) : !detail.factors?.signed && detail.meets_threshold === false ? (
                  <span className="badge badge-warn">blocked: unsigned or below threshold</span>
                ) : detail.meets_threshold ? (
                  <span className="badge badge-ok">deployable</span>
                ) : (
                  <span className="badge badge-warn">untrusted</span>
                )}
                <span className="num text-sm text-slate-300">trust {detail.trust_score ?? '—'}</span>
              </div>
              <pre data-testid="trust-json" className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(detail.factors ?? detail, null, 2)}</pre>
            </>
          )}
          <form onSubmit={associateAgent} className="flex gap-2">
            <input name="agent_id" required placeholder="Hive agent ID" />
            <button className="btn btn-primary">Associate</button>
          </form>

          <div className="flex gap-2 flex-wrap items-center">
            <button type="button" className="btn btn-primary" data-testid="generate-key" onClick={generateKey}>Generate key</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => runPackageAction('sign')}>Sign package</button>
            <button type="button" className="btn btn-ghost" disabled={busy || !signingKey} onClick={() => runPackageAction('verify')}>Verify signature</button>
          </div>

          {signingKey && (
            <div className="inset p-3 text-xs" data-testid="signing-key-state">
              <div>Public key ready.</div>
              <div className="text-slate-500">Private key retained only in this browser session for signing.</div>
            </div>
          )}
          {verification && (
            <div className="inset p-3 text-sm" data-testid="signature-result">
              Signature valid: <span className={verification.signature_valid ? 'text-emerald-400' : 'text-rose-400'}>{String(!!verification.signature_valid)}</span>
            </div>
          )
          }
          <div data-testid="package-agents">
            <span className="label">Associated agents</span>
            {associations.length ? associations.map((association) => (
              <div key={association.agent_id} className="text-sm text-slate-300">{association.agent_id}</div>
            )) : <div className="text-sm text-slate-600">None.</div>}
          </div>
        </section>
      )}

      <div className="grid xl:grid-cols-2 gap-6">
        <form
          data-testid="package-form"
          className="panel p-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit('/api/svc/forge/api/packages', { ...packageForm, file_path: packageForm.file_path || undefined })
          }}
        >
          <h2 className="font-semibold">Register package</h2>
          <input data-testid="package-name" required placeholder="agent-runtime" value={packageForm.name} onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })} />
          <input data-testid="package-version" required placeholder="1.0.0" value={packageForm.version} onChange={(event) => setPackageForm({ ...packageForm, version: event.target.value })} />
          <input data-testid="package-publisher" required placeholder="trusted-org" value={packageForm.publisher} onChange={(event) => setPackageForm({ ...packageForm, publisher: event.target.value })} />
          <input data-testid="package-path" placeholder="/path/to/package.tar.gz" value={packageForm.file_path} onChange={(event) => setPackageForm({ ...packageForm, file_path: event.target.value })} />
          <button data-testid="package-submit" className="btn btn-primary" disabled={busy}>Register</button>
        </form>

        <form
          data-testid="publisher-form"
          className="panel p-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit('/api/svc/forge/api/publishers', { ...publisherForm, trust_level: Number(publisherForm.trust_level) })
          }}
        >
          <h2 className="font-semibold">Trust publisher</h2>
          <input data-testid="publisher-name" required placeholder="trusted-org" value={publisherForm.publisher} onChange={(event) => setPublisherForm({ ...publisherForm, publisher: event.target.value })} />
          <textarea data-testid="publisher-key" required placeholder="Public signing key" value={publisherForm.public_key} onChange={(event) => setPublisherForm({ ...publisherForm, public_key: event.target.value })} />
          <button data-testid="publisher-submit" className="btn btn-primary" disabled={busy}>Trust publisher</button>
        </form>
      </div>

      {message && <div className={message.ok ? 'text-sm text-teal-300' : 'text-sm text-rose-400'}>{message.text}</div>}

      <section className="panel overflow-hidden" data-testid="supply-publishers">
        <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Trusted publishers</span></div>
        {publishers.length ? publishers.map((publisher) => (
          <div key={publisher.publisher ?? publisher.name} className="px-4 py-2 border-t border-[#232833]/60 text-sm text-slate-300">
            {publisher.publisher ?? publisher.name}
          </div>
        )) : <div className="p-6 text-sm text-slate-600">No trusted publishers.</div>}
      </section>
    </div>
  )
}
