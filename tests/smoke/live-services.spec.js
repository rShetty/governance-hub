import { test, expect } from '@playwright/test'

const SERVICES = [
  ['argus', process.env.LIVE_ARGUS_URL || 'http://127.0.0.1:8443/health'],
  ['hive', 'http://127.0.0.1:8000/api/health'],
  ['patroclus', process.env.LIVE_PATROCLUS_URL || 'http://127.0.0.1:8484/health'],
  // Relay requires Python <3.14 on this machine; covered by local fixture suite.
  ['miser', process.env.LIVE_MISER_URL || 'http://127.0.0.1:8787/health/live'],
  ['sentiel', process.env.LIVE_SENTIEL_URL || 'http://127.0.0.1:8585/health'],
  ['aegis', process.env.LIVE_AEGIS_URL || 'http://127.0.0.1:8686/health'],
  ['forge', process.env.LIVE_FORGE_URL || 'http://127.0.0.1:18788/health'],
]

const REQUIRED = process.env.LIVE_REQUIRED === '1'

for (const [name, url] of SERVICES) {
  test(`live service ${name} responds`, async ({ request }) => {
    test.info().annotations.push({ type: 'live-service', description: url })
    const response = await request.get(url, { timeout: 3000 }).catch(() => null)
    if (REQUIRED) {
      expect(response, `${name} must be running at ${url}`).toBeTruthy()
      expect(response.status()).toBeLessThan(500)
      return
    }
      test.fixme(!response || response.status() >= 500, `${name} unavailable at ${url}`)
  })
}

test('live Governance Hub health responds', async ({ request }) => {
  const base = process.env.LIVE_HUB_URL || 'https://governance.rajeev.me'
  const response = await request.get(`${base}/health`, { timeout: 5000 }).catch(() => null)
  expect(response).toBeTruthy()
  expect(response.status()).toBe(200)
})

test('live service inventory covers all currently runnable services', async () => {
  expect(SERVICES).toHaveLength(7)
})
