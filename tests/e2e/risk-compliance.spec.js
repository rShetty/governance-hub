import { test, expect } from '@playwright/test'

test('Risk workflows acknowledge alerts and verify attestations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Security' }).click()

  await expect(page.getByText('Spending spike detected')).toBeVisible()
  await page.getByTestId('acknowledge-alert_e2e_001').click()
  await expect(page.getByText('Alert acknowledged.')).toBeVisible()
  await expect(page.getByText('No open alerts.')).toBeVisible()

  await page.getByTestId('attestation-agent').fill('agt_e2e_001')
  await page.getByTestId('attestation-hash').fill('valid-hash')
  await page.getByTestId('verify-attestation').click()
  await expect(page.getByText('Attestation verified.')).toBeVisible()

  await page.getByTestId('geo-destination').fill('api.example.test')
  await page.getByTestId('check-geo').click()
  await expect(page.getByText('Geo verdict for api.example.test: allowed')).toBeVisible()
})
