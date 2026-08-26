import { test, expect } from '@playwright/test'

test('Access operators can simulate a policy before saving it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Access', exact: true }).click()
  await page.getByTestId('open-policy-wizard').click()
  await expect(page.getByTestId('hub-wizard')).toBeVisible()

  await page.getByTestId('policy-name').fill('allow-github')
  await page.getByTestId('wizard-next').click()

  await page.getByTestId('policy-actions').fill('call')
  await page.getByTestId('policy-resources').fill('mcp/*')
  await page.getByTestId('wizard-next').click()

  await page.getByTestId('simulate-action').fill('call')
  await page.getByTestId('simulate-resource').fill('mcp/github')
  await page.getByTestId('simulate-run').click()

  await expect(page.getByTestId('simulation-result')).toContainText('ALLOW')
})
