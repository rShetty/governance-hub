import { test, expect } from '@playwright/test'

test('Access operators list and create protected resources', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()

  await expect(page.getByTestId('resource-list')).toContainText('Fixture API')

  await page.getByPlaceholder('resource name').fill('Playwright Resource')
  await page.getByPlaceholder('api/service/*').fill('api/playwright/*')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText('Resource Playwright Resource created.')).toBeVisible()
})
