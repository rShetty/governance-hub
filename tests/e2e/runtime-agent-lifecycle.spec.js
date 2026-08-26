import { test, expect } from '@playwright/test'

test('Operators register runtime agents and run health checks', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()

  await page.getByTestId('runtime-name').fill('playwright-runtime')
  await page.getByTestId('runtime-endpoint').fill('https://agent.example.test')
  await page.getByTestId('runtime-submit').click()
  await expect(page.getByTestId('identity-action-result')).toContainText('registered.')

  await page.getByRole('button', { name: 'Check runtime agent health' }).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Check health' }).click()
  await expect(page.getByTestId('identity-action-result')).toContainText('healthy')
})
