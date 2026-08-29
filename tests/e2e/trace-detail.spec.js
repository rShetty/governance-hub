import { test, expect } from '@playwright/test'

test('Activity reconstructs a cross-service trace by session ID', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Activity', exact: true }).click()

  await page.getByTestId('activity-filter-session_id').fill('session-e2e')
  await page.getByTestId('activity-filter-session_id').press('Enter')

  await expect(page.getByTestId('trace-detail')).toContainText('Trace · session-e2e')
  await expect(page.getByTestId('trace-detail')).toContainText('policy.evaluate')
  await expect(page.getByTestId('trace-detail')).toContainText('egress.allowed')
  await expect(page.getByTestId('trace-detail')).toContainText('tool.invoke')
  await expect(page.getByTestId('trace-detail')).toContainText('relay')
  await expect(page.getByTestId('trace-detail')).toContainText('argus')
  await expect(page.getByTestId('trace-detail')).toContainText('forge')
})
