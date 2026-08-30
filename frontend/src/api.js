const BASE = import.meta.env.VITE_HUB_API ?? ''

/**
 * Proxy a GET to one of the governed services through the hub.
 * The hub injects the configured bearer token server-side.
 */
export async function svcGet(serviceId, path = '') {
  const r = await fetch(
    `${BASE}/api/svc/${serviceId}${path.startsWith('/') ? path : '/' + path}`,
    { credentials: 'same-origin' },
  )
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`${serviceId}${path}: ${r.status} ${body.slice(0, 200)}`)
  }
  return r.json()
}

export const fmtInt = (n) =>
  n == null ? '—' : new Intl.NumberFormat().format(n)

export const fmtMs = (n) => (n == null ? '—' : `${n} ms`)

export const fmtUsd = (n) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

// ---- Console: auth + administration ----

export async function me() {
  const r = await fetch(`${BASE}/api/me`, { credentials: 'same-origin' })
  if (r.status === 401) return null
  if (!r.ok) throw new Error(`me: ${r.status}`)
  return r.json()
}

export function loginUrl(next = '/') {
  return `${BASE}/login?next=${encodeURIComponent(next)}`
}
export const logoutUrl = `${BASE}/logout`

export async function identities() {
  const r = await fetch(`${BASE}/api/console/identities`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`identities: ${r.status}`)
  return r.json()
}
