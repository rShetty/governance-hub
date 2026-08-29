import { test, expect } from '@playwright/test'

test('Access operators list and create protected resources', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()

  await expect(page.getByTestId('resource-list')).toContainText('Fixture API')

  await page.getByTestId('open-resource-dialog').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-name').fill('Playwright Resource')
  await page.getByTestId('dialog-uri').fill('api/playwright/*')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Create resource' }).click()
  await expect(page.getByTestId('toast-success')).toContainText('Resource Playwright Resource created.')
})
