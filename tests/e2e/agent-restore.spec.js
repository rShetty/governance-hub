import { test, expect } from '@playwright/test'

test('Admin can restore a Patroclus emergency-stopped agent', async ({ page }) => {
  const response = await page.request.post('/api/bff/agents/00000000-0000-0000-0000-000000000009/restore')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.status).toBe('restored')
})

test('Admin clears a Patroclus emergency stop through the Agents UI', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()
  page.on('dialog', (dialog) => dialog.accept('00000000-0000-0000-0000-000000000009'))

  const killPromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/bff/agents/00000000-0000-0000-0000-000000000009/emergency-kill')
  )
  await page.getByRole('button', { name: 'Emergency stop' }).click()
  expect((await killPromise).status()).toBe(200)

  const restorePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/bff/agents/00000000-0000-0000-0000-000000000009/restore')
  )
  await page.getByTestId('agent-restore-btn').click()
  expect((await restorePromise).status()).toBe(200)
  await expect(page.getByTestId('identity-action-result')).toContainText('Emergency stop cleared')
})
