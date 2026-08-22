import { useEffect, useState } from 'react'
import { upsertService, deleteService } from '../api'

const BLANK = {
  id: '',
  label: '',
  description: '',
  url: '',
  public_url: '',
  ui_path: '',
  health_path: '/health',
  color: '#6366f1',
  api_token: '',
}

export default function Services({ onChanged }) {
  const [form, setForm] = useState(BLANK)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { ...form }
      for (const k of ['public_url', 'ui_path', 'api_token']) {
        if (!body[k]) delete body[k]
      }
      const r = await upsertService(body)
      setMsg({ ok: true, text: r.note || 'Stored.' })
      setForm(BLANK)
      onChanged?.()
    } catch (e2) {
      setMsg({ ok: false, text: String(e2.message || e2) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!form.id) return setMsg({ ok: false, text: 'Enter the service id to remove.' })
    if (!confirm(`Remove service "${form.id}" from the registry?`)) return
    setBusy(true)
    try {
      await deleteService(form.id)
      setMsg({ ok: true, text: `Removed ${form.id}.` })
      setForm(BLANK)
      onChanged?.()
    } catch (e2) {
      setMsg({ ok: false, text: String(e2.message || e2) })
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500'

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-800 p-5">
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-slate-500">id (a-z0-9-)</span>
          <input className={input} value={form.id} onChange={set('id')} placeholder="sentiel" required />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Label</span>
          <input className={input} value={form.label} onChange={set('label')} placeholder="Sentiel" required />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs text-slate-500">Internal URL (probed server-side)</span>
          <input className={input} value={form.url} onChange={set('url')} placeholder="http://127.0.0.1:8585" required />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs text-slate-500">Description</span>
          <input className={input} value={form.description} onChange={set('description')} placeholder="Observability, DLP & compliance" required />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Health path</span>
          <input className={input} value={form.health_path} onChange={set('health_path')} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">UI deep link</span>
          <input className={input} value={form.ui_path} onChange={set('ui_path')} placeholder="http://127.0.0.1:8585/" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Accent color</span>
          <input className={input} value={form.color} onChange={set('color')} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">API token (optional, server-side only)</span>
          <input className={input} type="password" value={form.api_token} onChange={set('api_token')} placeholder="sk-…" />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-sm font-semibold text-white"
        >
          {busy ? 'Working…' : 'Save service'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy || !form.id}
          className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-sm disabled:opacity-40 hover:bg-rose-500/20"
        >
          Remove
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</span>
        )}
      </div>
      <p className="text-[11px] text-slate-600">
        Services persist under <code className="text-slate-500">/etc/governance-hub/services.d/&lt;id&gt;.toml</code> and appear on the board after the next probe cycle.
      </p>
    </form>
  )
}
