import { test, expect } from '@playwright/test'

test('Admin can restore a Patroclus emergency-stopped agent', async ({ page }) => {
  const response = await page.request.post('/api/bff/agents/00000000-0000-0000-0000-000000000009/restore')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.status).toBe('restored')
})
