import { test, expect } from '@playwright/test'

test('Security containment revokes and stops a failed-attestation agent', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Security' }).click()
  await expect(page.getByTestId('contain-agent')).toBeVisible()

  await page.getByTestId('contain-agent').fill('agt_e2e_001')
  await page.getByTestId('contain-reason').fill('failed runtime attestation')
  page.once('dialog', dialog => dialog.accept())
  await page.getByTestId('contain-submit').click()

  await expect(page.getByText('Contained agt_e2e_001.')).toBeVisible()
})
