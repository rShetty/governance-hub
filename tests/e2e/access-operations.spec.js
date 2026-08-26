import { test, expect } from '@playwright/test'

test('Access operations approve requests and kill live sessions', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Access', exact: true }).click()

  await page.getByTestId('approve-apr_e2e_001').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-reason').fill('Approved from Governance Hub')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByTestId('toast-success').filter({ hasText: 'Approval resolved.' })).toBeVisible()
  await expect(page.getByTestId('approve-apr_e2e_001')).toBeHidden()

  await page.getByTestId('modal-close').click()
  await expect(page.getByTestId('hub-modal')).toBeHidden()

  await page.getByTestId('kill-ses_e2e_001').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Kill session' }).click()
  await expect(page.getByTestId('toast-success').filter({ hasText: 'Session killed.' })).toBeVisible()
  await expect(page.getByTestId('no-sessions')).toBeVisible()
})

test('Access operators can inspect a live session', async ({ page }) => {
  const response = await page.request.get('/api/bff/access/sessions/ses_e2e_001')
  expect(response.status()).toBe(200)
  const session = await response.json()
  expect(session.spend_total).toBe(0.25)
  expect(session.trust_level).toBe(0.95)
})
