import { test, expect } from '@playwright/test'

test('Compliance shows control coverage and evidence gaps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Compliance' }).click()

  await expect(page.getByTestId('coverage-total')).toContainText('2')
  await expect(page.getByTestId('coverage-complete')).toContainText('1')
  await expect(page.getByTestId('coverage-gaps')).toContainText('1')
})

test('Egress operators create an attributed Aegis destination policy', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Egress' }).click()

  await expect(page.getByTestId('destination-policy-form')).toBeVisible()
  await page.getByPlaceholder('api.example.test').fill('blocked.example.test')
  await page.getByRole('combobox').selectOption('block')
  await page.getByPlaceholder('reason').fill('data residency violation')
  await page.getByTestId('save-policy').click()

  await expect(page.getByText('Policy blocked.example.test saved.')).toBeVisible()
  await expect(page.getByTestId('policy-blocked.example.test')).toContainText('block')
  await expect(page.getByTestId('policy-blocked.example.test')).toContainText('owner e2e@governance.test')
})
