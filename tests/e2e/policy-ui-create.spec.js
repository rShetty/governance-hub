import { test, expect } from '@playwright/test'

test('Access view refreshes after policy API creation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByTestId('policy-pol_e2e_001')).toBeVisible()

  const policyName = `refresh-policy-${Date.now().toString(36)}`
  await page.evaluate(async (name) => {
    await fetch('/api/bff/policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, engine: 'yaml', definition: '- name: allow\n  decision: allow' }),
    })
  }, policyName)

  await page.getByRole('button', { name: 'Mission Control' }).click()
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.locator(`[data-testid="policy-${policyName}"]`).or(page.getByText(policyName))).toBeVisible()
})
