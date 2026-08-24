import { useEffect, useState } from 'react'

export default function Vault() {
  const [credentials, setCredentials] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/svc/patroclus/v1/vault/credentials')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => setCredentials(Array.isArray(data) ? data : data.credentials ?? []))
      .catch((cause) => setError(String(cause.message || cause)))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Credential Vault</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Patroclus vault posture. Secret creation and vending remain backend-only for safety.
        </p>
      </div>
      {error && <div className="panel p-4 text-sm text-amber-300">{error}</div>}
      {!credentials && !error && <div className="panel p-6 text-sm text-slate-600">Loading…</div>}
      {credentials && (
        <section className="panel overflow-hidden" data-testid="vault-list">
          <div className="px-4 py-3 border-b border-[#232833]"><span className="label">Stored credential metadata</span></div>
          {credentials.map((credential, index) => (
            <div key={credential.id ?? index} className="px-4 py-2 border-t border-[#232833]/60 flex items-center gap-3 text-sm">
              <span className="text-slate-200">{credential.provider}</span>
              <span className="text-xs text-slate-500">{(credential.scopes ?? []).join(', ') || 'no scopes'}</span>
            </div>
          ))}
          {!credentials.length && <div className="p-6 text-sm text-slate-600" data-testid="vault-empty">No credentials stored.</div>}
        </section>
      )}
    </div>
  )
}
