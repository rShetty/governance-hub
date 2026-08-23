import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
test('debug cookie sharing', async ({ page }) => {
  await login(page)
  const me = await page.request.get(`${process.env.E2E_BASE_URL}/api/me`)
  console.log('page.request /api/me:', me.status())
  const cookies = await page.context().cookies()
  console.log('cookies:', cookies.map(c => c.name).join(','))
})
