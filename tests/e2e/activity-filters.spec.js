import { test, expect } from '@playwright/test'

test('Activity filters by service source', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Activity' }).click()
  await expect(page.getByTestId('activity-feed')).toBeVisible()

  await page.getByTestId('activity-filter-source').fill('sentiel')
  await expect(page.getByText('dlp.violation')).toBeVisible()
  await expect(page.getByText('egress.block')).toBeHidden()
})
