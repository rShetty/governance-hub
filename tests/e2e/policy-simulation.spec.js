import { test, expect } from '@playwright/test'

test('Access operators can simulate a policy before saving it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByTestId('policy-simulator')).toBeVisible()

  await page.getByTestId('simulate-action').fill('call')
  await page.getByTestId('simulate-resource').fill('mcp/github')
  await page.getByTestId('simulate-yaml').fill('- name: allow-github\n  actions: ["call"]\n  resources: ["mcp/*"]\n  decision: allow')
  await page.getByTestId('simulate-run').click()

  await expect(page.getByTestId('simulation-result')).toContainText('"decision": "allow"')
})
