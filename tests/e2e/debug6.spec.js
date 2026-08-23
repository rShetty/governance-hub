import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
test('debug prod session', async ({ page }) => {
  await login(page)
  console.log('url:', page.url())
  const me = await page.request.get(`${process.env.E2E_BASE_URL}/api/me`)
  console.log('/api/me:', me.status(), (await me.text()).slice(0, 100))
  const reg = await page.request.post(`${process.env.E2E_BASE_URL}/api/svc/hive/api/auth/register`, {
    data: { username: 'dbg' + Date.now().toString(36), password: 'DbgPass12345', email: 'dbg' + Date.now().toString(36) + '@test.dev', name: 'D' },
  })
  console.log('register via proxy:', reg.status(), (await reg.text()).slice(0, 80))
})
