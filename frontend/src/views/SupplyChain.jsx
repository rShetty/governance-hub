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
                <tr key={item.id}>
                  <td className="text-slate-200">{item.name}<div className="text-xs text-slate-600">{item.version}</div></td>
                  <td className="text-slate-400">{item.publisher}</td>
                  <td><span className={`badge ${item.signature ? 'badge-ok' : 'badge-warn'}`}>{item.signature ? 'signed' : 'unsigned'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
