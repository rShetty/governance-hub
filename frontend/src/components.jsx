import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { svcGet } from './api.js'

export function useSvc(serviceId, paths) {
  const [data, setData] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all(
      paths.map(([key, path]) =>
        svcGet(serviceId, path).then((v) => [key, v]).catch((e) => [key, { __error: e.message }]),
      ),
    ).then((entries) => {
      if (!alive) return
      setData(Object.fromEntries(entries))
      const errs = entries.filter(([, v]) => v.__error)
      setError(errs.length ? errs.map(([, v]) => v.__error).join(' · ') : null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [serviceId, JSON.stringify(paths)])

  return { data, error, loading }
}

export function Panel({ title, subtitle, children, actions }) {
  return (
    <div className="glass p-5 fade-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Table({ cols, rows, empty }) {
  if (!rows?.length) return <p className="text-sm text-slate-500 py-4">{empty ?? 'No records.'}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/40">
              {cols.map((c) => (
                <td key={c} className="px-2 py-2.5 align-top font-mono text-[12px] text-slate-300 max-w-[22ch] truncate" title={String(r[c] ?? '')}>
                  {r[c] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ResponsiveTable({ caption, columns, rows, renderCard }) {
  return (
    <>
      <table className="data" aria-label={caption}>
        <thead>
          <tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>{columns.map((column) => <td key={column.key}>{column.value(row)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <div className="mobile-data-list px-4 py-4">
        {rows.map((row, index) => (
          <article key={row.id ?? index} className="inset p-4">{renderCard(row)}</article>
        ))}
      </div>
    </>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  // Degrade gracefully for auth/token issues — show a clean message, not raw JSON.
  const isAuthError = /401|403/.test(error)
  if (isAuthError) {
    return (
      <div className="panel p-4 text-sm text-slate-400 border-slate-700 mb-4" data-testid="svc-degraded">
        Some backend services are not yet connected to this deployment. Configure service tokens in the Hub environment to enable live data.
      </div>
    )
  }
  return (
    <div className="glass p-4 text-sm text-amber-300 border-amber-900/60 mb-4">
      ⚠︎ Service degraded or unreachable — {error}
    </div>
  )
}

export function Skeleton() {
  return <div className="glass h-64 animate-pulse" />
}

export function useLoaded(view) {
  return loading ? <Skeleton /> : null
}

export function Guard({ loading, error, children }) {
  return (
    <>
      <ErrorNote error={error} />
      {loading ? <Skeleton /> : children}
    </>
  )
}

const ToastContext = createContext(null)

function useFocusTrap(open, ref, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const node = ref.current
    if (!node) return undefined
    const previous = document.activeElement
    const focusables = () => Array.from(node.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter((item) => item.offsetParent !== null)
    requestAnimationFrame(() => {
      const initial = node.contains(document.activeElement) ? document.activeElement : focusables()[0]
      const preferred = node.querySelector('[data-autofocus="true"]')
      ;(preferred ?? initial)?.focus()
    })
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const active = items.indexOf(document.activeElement)
      if (event.shiftKey && active <= 0) {
        event.preventDefault()
        items[items.length - 1].focus()
      } else if (!event.shiftKey && active === items.length - 1) {
        event.preventDefault()
        items[0].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open, ref, onClose])
}

export function Modal({ open, title, description, children, onClose }) {
  const panelRef = useRef(null)
  useFocusTrap(open, panelRef, onClose)
  if (!open) return null
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        data-testid="hub-modal"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="h-display text-lg">{title}</h2>
            {description && <p id="modal-description" className="mt-1 text-sm text-[#b7c0cd]">{description}</p>}
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} data-testid="modal-close" aria-label="Close dialog">✕</button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-[#c9d1de]">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm} data-testid="confirm-action" data-autofocus="true">
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function PromptDialog({ open, title, description, fields, submitLabel = 'Continue', busy = false, onSubmit, onCancel }) {
  const [values, setValues] = useState({})
  const fieldKey = JSON.stringify(fields)
  useEffect(() => {
    if (open) setValues(Object.fromEntries(JSON.parse(fieldKey).map((field) => [field.name, field.value ?? ''])))
  }, [open, fieldKey])
  const submit = (event) => {
    event.preventDefault()
    onSubmit(values)
  }
  return (
    <Modal open={open} title={title} description={description} onClose={onCancel}>
      <form onSubmit={submit} className="grid gap-4">
        {fields.map((field) => (
          <label key={field.name} className="grid gap-2 text-sm">
            <span className="label">{field.label}</span>
            {field.textarea ? (
              <textarea required={field.required !== false} rows={field.rows ?? 3} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} data-testid={`dialog-${field.name}`} />
            ) : field.type === 'select' ? (
              <select required={field.required !== false} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} data-testid={`dialog-${field.name}`}>
                <option value="" disabled>Select {field.label.toLowerCase()}</option>
                {(field.options ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            ) : (
              <input type={field.type ?? 'text'} required={field.required !== false} value={values[field.name] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} data-testid={`dialog-${field.name}`} />
            )}
          </label>
        ))}
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Working…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  )
}

export function WizardModal({
  open,
  title,
  description,
  steps,
  activeStep,
  onStepChange,
  onNext,
  onBack,
  onFinish,
  canContinue = true,
  busy = false,
  finishLabel = 'Create',
  children,
  onCancel,
}) {
  const stepMeta = steps[activeStep]
  const isLast = activeStep === steps.length - 1
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel?.()}>
      <section className="dialog dialog-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title" data-testid="hub-wizard">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="wizard-title" className="h-display text-lg">{title}</h2>
            {description && <p className="mt-1 text-sm text-[#b7c0cd]">{description}</p>}
          </div>
          <button type="button" className="btn btn-ghost" onClick={onCancel} aria-label="Close wizard">✕</button>
        </div>

      <div className="mb-5 flex items-center gap-2" data-testid="wizard-stepper">
        {steps.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
                index < activeStep
                  ? 'border-teal-500/40 bg-teal-500/15 text-teal-300'
                  : index === activeStep
                    ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                    : 'border-[#232833] text-[#6b7484]'
              }`}
              aria-current={index === activeStep ? 'step' : undefined}
            >
              {index + 1}
            </span>
            <span className={`text-xs font-semibold ${index === activeStep ? 'text-white' : 'text-[#8d97a6]'}`}>{label}</span>
            {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-[#232833]" aria-hidden />}
          </div>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!isLast) onNext?.()
        }}
        className="grid gap-5"
      >
        <h3 className="text-base font-semibold text-white" data-testid="wizard-step-label">{stepMeta}</h3>
        {children}

        <div className="mt-2 flex items-center justify-between gap-3">
          <button type="button" className="btn" onClick={onBack} disabled={activeStep === 0 || busy}>
            ← Back
          </button>
          <button
            type={isLast ? 'button' : 'submit'}
            className={`btn ${isLast ? 'btn-primary' : ''}`}
            disabled={!canContinue || busy}
            onClick={isLast ? onFinish : undefined}
            data-testid={isLast ? 'wizard-finish' : 'wizard-next'}
          >
            {busy ? 'Working…' : isLast ? finishLabel : 'Continue'}
          </button>
        </div>
      </form>
      </section>
    </div>
  )
}

let toastSequence = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const notify = useCallback((kind, text) => {
    const id = ++toastSequence
    setToasts((current) => [...current, { id, kind, text }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000)
  }, [])
  const value = useMemo(() => ({
    success: (text) => notify('success', text),
    error: (text) => notify('error', text),
  }), [notify])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        <div aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.kind}`} data-testid={`toast-${toast.kind}`}>{toast.text}</div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

export function PageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="h-display text-3xl leading-tight">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#aeb7c4]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  )
}

export function ResourceSelect({ label, name, options, required = true }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="label">{label}</span>
      <select
        className="input"
        name={name}
        required={required}
        defaultValue=""
        data-testid={`select-${name}`}
      >
        <option value="" disabled={required}>Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}{option.status ? ` · ${option.status}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

export function usePagination(items, pageSize = 20) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil((items?.length ?? 0) / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = (items ?? []).slice(safePage * pageSize, (safePage + 1) * pageSize)
  return {
    page: safePage,
    setPage,
    totalPages,
    total: items?.length ?? 0,
    pageItems,
    reset: () => setPage(0),
  }
}

export function PaginationControls({ testIdPrefix, page, totalPages, total, singular = 'item', plural = 'items', onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#232833] px-4 py-3">
      <span className="num text-xs text-[#8d97a6]">Page {page + 1} of {totalPages} · {total} {total === 1 ? singular : plural}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost !px-2"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          data-testid={`${testIdPrefix}-page-prev`}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost !px-2"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          data-testid={`${testIdPrefix}-page-next`}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
