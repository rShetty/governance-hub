const BASE = import.meta.env.VITE_HUB_API ?? ''

export async function fetchServices() {
  const r = await fetch(`${BASE}/api/services`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`services: ${r.status}`)
  return r.json()
}

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

export async function upsertService(svc) {
  const r = await fetch(`${BASE}/api/console/services`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(svc),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `upsert: ${r.status}`)
  return body
}

export async function deleteService(id) {
  const r = await fetch(`${BASE}/api/console/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `delete: ${r.status}`)
  return body
}
