import { useEffect, useState } from 'react'

const FRAMEWORKS = [
  ['soc2', 'SOC 2'],
  ['gdpr', 'GDPR'],
  ['eu_ai_act', 'EU AI Act'],
  ['hipaa', 'HIPAA'],
]

export default function Compliance() {
  const [framework, setFramework] = useState('soc2')
  const [reports, setReports] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetch(`/api/svc/sentiel/api/compliance/${framework}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
      .then((data) => { if (alive) setReports((current) => ({ ...current, [framework]: data })) })
      .catch((cause) => { if (alive) setError(String(cause.message || cause)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [framework])

  const report = reports[framework]
  const controls = Array.isArray(report?.controls)
    ? report.controls
    : Object.entries(report ?? {}).flatMap(([section, value]) =>
        Array.isArray(value) ? value.map((control) => ({ section, ...control })) : [],
      )
  const complete = controls.filter((control) => /complete|pass|satisfied|implemented/i.test(String(control.status ?? control.state ?? ''))).length
  const gaps = controls.length - complete

  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ framework, report, exported_at: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${framework}-compliance-evidence.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-2xl">Compliance</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Sentiel control evidence across ecosystem frameworks.</p>
      </div>
      <div className="flex gap-2">
        {FRAMEWORKS.map(([id, label]) => (
          <button key={id} data-testid={`framework-${id}`} onClick={() => setFramework(id)} className={`px-4 py-1.5 rounded-full text-xs font-semibold ${framework === id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="panel p-4 text-sm text-amber-300">Sentiel unavailable — {error}</div>}
      {loading && !report && <div className="panel p-6 text-sm text-slate-600">Loading report…</div>}
      {report && (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            <section className="panel p-5" data-testid="coverage-total">
              <span className="label">Controls evaluated</span>
              <p className="mt-2 num text-2xl text-slate-100">{controls.length}</p>
            </section>
            <section className="panel p-5" data-testid="coverage-complete">
              <span className="label">Evidence complete</span>
              <p className="mt-2 num text-2xl text-emerald-400">{complete}</p>
            </section>
            <section className="panel p-5" data-testid="coverage-gaps">
              <span className="label">Evidence gaps</span>
              <p className={`mt-2 num text-2xl ${gaps ? 'text-rose-400' : 'text-slate-100'}`}>{gaps}</p>
            </section>
          </div>
          <section className="panel p-5" data-testid="compliance-report">
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{JSON.stringify(report, null, 2)}</pre>
          </section>
          <button className="btn btn-primary" data-testid="export-compliance" onClick={exportReport}>Export evidence</button>
        </>
      )}
    </div>
  )
}
