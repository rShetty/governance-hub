import { test, expect } from '@playwright/test'

test('Mission Control displays live unified signals', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('mission-signals')).toBeVisible()
  await expect(page.getByTestId('mission-signals').getByText('dlp.violation')).toBeVisible()
  await expect(page.getByTestId('mission-signals').getByText('egress.block')).toBeVisible()
})
