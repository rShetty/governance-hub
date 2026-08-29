import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto('/')
})

test('Access operators deny an approval with a recorded reason', async ({ page }) => {
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByTestId('pending-approvals')).toBeVisible()
  await expect(page.getByTestId('approve-apr_e2e_001')).toBeVisible()

  await page.getByTestId('deny-apr_e2e_001').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-reason').fill('request lacks business justification')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Deny approval' }).click()

  await expect(page.getByTestId('toast-success')).toContainText('Approval apr_e2e_001 denied.')
  await expect(page.getByTestId('deny-apr_e2e_001')).not.toBeVisible()
})

test('Access operators delete a policy through a confirmed dialog', async ({ page }) => {
  // Create a disposable policy through the BFF.
  const created = await page.request.post('/api/bff/policies', {
    data: {
      name: `delete-me-${Date.now().toString(36)}`,
      engine: 'yaml',
      definition: '- name: temp\n  actions: ["call"]\n  resources: ["tmp/*"]\n  decision: allow',
    },
  })
  expect(created.status()).toBe(201)
  const policy = await created.json()

  await page.getByRole('button', { name: 'Access' }).click()
  const row = page.getByTestId(`policy-${policy.id}`)
  await expect(row).toBeVisible()

  await row.getByTestId(`delete-policy-${policy.id}`).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByRole('button', { name: 'Delete policy' }).click()

  await expect(page.getByTestId('toast-success')).toContainText(`Policy ${policy.name} deleted.`)
  await expect(page.getByTestId(`policy-${policy.id}`)).not.toBeVisible()
})

test('Access operators inspect protected resource detail', async ({ page }) => {
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByTestId('resource-list')).toContainText('Fixture API')

  await page.getByTestId('resource-detail-res_e2e_001').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await expect(page.getByTestId('hub-modal')).toContainText('api/fixture/*')
  await expect(page.getByTestId('hub-modal')).toContainText('sensitivity: medium')
  await page.getByTestId('modal-close').click()
  await expect(page.getByTestId('hub-modal')).not.toBeVisible()
})

test('Session inspector shows trajectory and constraints', async ({ page }) => {
  await page.getByRole('button', { name: 'Access' }).click()
  await page.getByTestId('inspect-ses_e2e_001').click()

  await expect(page.getByTestId('session-trajectory')).toBeVisible()
  await expect(page.getByTestId('session-trajectory')).toContainText('session.start')
  await expect(page.getByTestId('session-trajectory')).toContainText('policy.evaluate')
  await expect(page.getByTestId('session-trajectory')).toContainText('tool.invoke')

  await expect(page.getByTestId('session-constraints')).toBeVisible()
  await expect(page.getByTestId('session-constraints')).toContainText('relay:call')
  await expect(page.getByTestId('session-constraints')).toContainText('RPM ≤ 120')
  await expect(page.getByTestId('session-constraints')).toContainText('Budget $50')
})

test('Policy wizard verifies access through authenticated Patroclus check-access', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Tools & MCP', exact: true }).click()
  await page.getByTestId('create-policy-server-e2e').click()
  await expect(page.getByTestId('hub-wizard')).toBeVisible()

  await page.getByTestId('policy-name').fill('check-access-proof')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('policy-actions').fill('call')
  await page.getByTestId('policy-resources').fill('server-e2e/read_data')
  await page.getByTestId('wizard-next').click()

  // Advisory draft preview…
  await page.getByTestId('simulate-run').click()
  await expect(page.getByTestId('simulation-result')).toContainText('ALLOW')

  // …then the authenticated check against Patroclus's live engine.
  await page.getByTestId('check-principal').fill('agt_e2e_001')
  await page.getByTestId('check-access-run').click()
  await expect(page.getByTestId('check-access-result')).toContainText('ALLOW')
  await expect(page.getByTestId('check-access-result')).toContainText('pol_e2e_001')
})
