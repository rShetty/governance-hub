import { test, expect } from '@playwright/test'

test('Activity displays normalized cross-service events from all eight sources', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(page.getByTestId('activity-feed')).toBeVisible()
  await expect(page.getByText('policy.evaluate')).toBeVisible()
  await expect(page.getByText('key.active')).toBeVisible()
  await expect(page.getByText('agent.registered')).toBeVisible()
  await expect(page.getByText('dlp.violation')).toBeVisible()
  await expect(page.getByText('egress.block')).toBeVisible()
  await expect(page.getByText('identity.event')).toBeVisible()
  await expect(page.getByText('package.signed')).toBeVisible()
  await expect(page.getByText('tool.invoke')).toBeVisible()
  await expect(page.getByTestId('activity-empty')).toBeHidden()
})
