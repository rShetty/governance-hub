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
  await page.getByTestId('runtime-name').fill('playwright-runtime')
  await page.getByTestId('runtime-endpoint').fill('https://agent.example.test')
  await page.getByTestId('runtime-submit').click()
  await expect(page.getByTestId('identity-action-result')).toContainText('registered.')

  await page.getByRole('button', { name: 'Emergency stop' }).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').selectOption({ label: 'playwright-runtime' })
  await page.getByTestId('dialog-reason').fill('contained compromised credentials')
  await page.getByRole('button', { name: 'Apply stop' }).click()
  await expect(page.getByTestId('identity-action-result')).toContainText('Emergency stop applied')

  await page.getByTestId('agent-restore-btn').click()
  page.once('dialog', dialog => dialog.accept())
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').selectOption({ label: 'playwright-runtime' })
  await page.getByRole('button', { name: 'Clear stop' }).click()
  await expect(page.getByTestId('identity-action-result').filter({ hasText: 'Emergency stop cleared' })).toBeVisible({ timeout: 15000 })
})
