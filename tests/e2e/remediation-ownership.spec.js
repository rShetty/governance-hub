import { test, expect } from '@playwright/test'

test('Security operators assign risk remediation to an accountable owner', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Security' }).click()
  await expect(page.getByTestId('remediation-form')).toBeVisible()

  await page.getByPlaceholder('subject / agent id').fill('agt_e2e_001')
  await page.getByPlaceholder('action required').fill('Replace compromised runtime binary and re-attest')
  await page.getByPlaceholder('owner email').fill('security-owner@governance.test')
  await page.getByTestId('remediation-submit').click()

  await expect(page.getByText(/Remediation rem_.+ assigned to security-owner@governance.test\./)).toBeVisible()
})
