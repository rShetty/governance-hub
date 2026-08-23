import { test, expect } from '@playwright/test'
test('debug cookie sharing', async ({ page }) => {
  await page.goto('/__test__/admin')
  const me = await page.request.get(`${process.env.E2E_BASE_URL}/api/me`)
  console.log('page.request /api/me:', me.status())
  const cookies = await page.context().cookies()
  console.log('cookies:', cookies.map(c => c.name).join(','))
})
