import { test, expect } from '@playwright/test'

test('Operators can apply a confirmed Patroclus emergency stop', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()

  await page.getByTestId('open-runtime-wizard').click()
  await expect(page.getByTestId('hub-wizard')).toBeVisible()
  await page.getByTestId('runtime-name').fill('playwright-runtime')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('runtime-endpoint').fill('https://agent.example.test')
  await page.getByTestId('wizard-finish').click()
  await expect(page.getByTestId('identity-action-result')).toContainText('registered.')

  await page.getByRole('button', { name: 'Emergency stop' }).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-agent_id').selectOption({ label: 'playwright-runtime' })
  await page.getByTestId('dialog-reason').fill('contain compromised credentials')
  await page.getByRole('button', { name: 'Apply stop' }).click()

  await expect(page.getByTestId('identity-action-result')).toContainText('Emergency stop applied')
})
