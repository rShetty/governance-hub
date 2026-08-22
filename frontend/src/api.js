const BASE = import.meta.env.VITE_HUB_API ?? ''

export async function fetchServices() {
  const r = await fetch(`${BASE}/api/services`)
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
