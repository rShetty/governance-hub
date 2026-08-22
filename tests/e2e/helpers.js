// Shared login helper — performs the full Argus SSO dance in the browser.
export async function login(page) {
  await page.goto(process.env.E2E_BASE_URL || 'https://governance.rajeev.me', { waitUntil: 'domcontentloaded' })
  if (!page.url().includes('id.rajeev.me')) return // already authenticated
  const email = process.env.E2E_EMAIL || 'rajeev@rajeev.me'
  const password = process.env.E2E_PASSWORD || ''
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  const approve = page.getByRole('button', { name: 'Approve' })
  if (await approve.isVisible({ timeout: 4000 }).catch(() => false)) await approve.click()
  await page.waitForURL(/governance\.rajeev\.me/, { timeout: 20000 })
}
