import { test, expect } from '@playwright/test'

test('Activity uses canonical events, filters severity, and exports evidence', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Activity', exact: true }).click()

  await expect(page.getByText('governance.event.v1')).toBeVisible()
  await expect(page.getByTestId('activity-feed')).toContainText('critical')
  const download = page.waitForEvent('download')
  await page.getByTestId('export-activity').click()
  expect((await download).suggestedFilename()).toMatch(/^activity-evidence-\d+\.json$/)
})

test('Canonical activity filters reconstruct a session trace', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Activity', exact: true }).click()

  await page.getByTestId('activity-filter-source').fill('patroclus')
  await expect(page.getByText('policy.evaluate')).toBeVisible()
  await expect(page.getByText('egress.block')).toBeHidden()

  await page.getByTestId('activity-filter-session_id').fill('session-e2e')
  await page.getByTestId('activity-filter-session_id').press('Enter')
  await expect(page.getByTestId('trace-detail')).toContainText('Trace · session-e2e')
})
