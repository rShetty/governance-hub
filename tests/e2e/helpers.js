// Shared login helper — performs the full Argus SSO dance in the browser.
export async function login(page) {
  await page.goto(process.env.E2E_BASE_URL || 'https://governance.rajeev.me', { waitUntil: 'domcontentloaded' })
  if (!/\/login(\?|$)/.test(new URL(page.url()).pathname + new URL(page.url()).search) && !page.url().includes('/login')) return // already authenticated
  const email = process.env.E2E_EMAIL || 'rajeev@rajeev.me'
  const password = process.env.E2E_PASSWORD || ''
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  const approve = page.getByRole('button', { name: 'Approve' })
  if (await approve.isVisible({ timeout: 4000 }).catch(() => false)) await approve.click()
  const base = new URL(process.env.E2E_BASE_URL || 'https://governance.rajeev.me')
  await page.waitForURL((u) => u.origin === base.origin, { timeout: 20000 })
}
