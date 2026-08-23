import { test, expect } from '@playwright/test'

test('Access operations approve requests and kill live sessions', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Access' }).click()

  page.once('dialog', dialog => dialog.accept('00000000-0000-0000-0000-000000000001'))
  await page.getByTestId('approve-apr_e2e_001').click()
  await expect(page.getByText('Approval resolved.')).toBeVisible()
  await expect(page.getByTestId('approve-apr_e2e_001')).toBeHidden()

  await page.getByTestId('kill-ses_e2e_001').click()
  await expect(page.getByText('Session killed.')).toBeVisible()
  await expect(page.getByTestId('no-sessions')).toBeVisible()
})
