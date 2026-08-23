import { test, expect } from '@playwright/test'

test('Operators can apply a confirmed Patroclus emergency stop', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agents' }).click()

  const dialogs = ['00000000-0000-0000-0000-000000000009', 'contain compromised credentials']
  let index = 0
  page.on('dialog', dialog => dialog.accept(dialogs[index++]))

  await page.getByRole('button', { name: 'Emergency stop' }).click()

  await expect(page.getByTestId('identity-action-result')).toContainText('Emergency stop applied')
})
