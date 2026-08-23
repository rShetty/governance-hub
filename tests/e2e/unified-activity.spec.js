import { test, expect } from '@playwright/test'

test('Activity displays normalized cross-service events', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Activity' }).click()
  await expect(page.getByTestId('activity-feed')).toBeVisible()
  await expect(page.getByText('dlp.violation')).toBeVisible()
  await expect(page.getByText('egress.block')).toBeVisible()
  await expect(page.getByTestId('activity-empty')).toBeHidden()
})
