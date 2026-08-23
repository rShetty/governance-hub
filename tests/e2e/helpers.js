// Shared login helper — performs the full Argus SSO dance in the browser.
export async function login(page) {
  const base = new URL(process.env.E2E_BASE_URL || 'https://governance.rajeev.me')
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(base.origin, { waitUntil: 'domcontentloaded' })
    if (!page.url().includes('/login')) return // already authenticated
    const email = process.env.E2E_EMAIL || 'rajeev@rajeev.me'
    const password = process.env.E2E_PASSWORD || ''
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')
    const approve = page.getByRole('button', { name: 'Approve' })
    if (await approve.isVisible({ timeout: 4000 }).catch(() => false)) await approve.click()
    try {
      await page.waitForURL((u) => u.origin === base.origin, { timeout: 15000 })
      return
    } catch {
      // stale cookies can wedge the dance; clear and retry once
      await page.context().clearCookies()
    }
  }
  throw new Error(`login failed after retries: ${page.url()}`)
}
