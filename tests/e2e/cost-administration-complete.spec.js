import { test, expect } from '@playwright/test'

test('Cost view shows quotas, expiry, spend, health, and audit integrity', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cost & Routing' })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Cost & Routing' }).click()
  await expect(page.getByText(/Miser gateway/)).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Provisioned keys')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('miser-key-key_e2e_001')).toBeVisible({ timeout: 15000 })

  await expect(page.getByTestId('miser-key-key_e2e_001')).toContainText('simple')
  await expect(page.getByTestId('miser-key-key_e2e_001')).toContainText('120 RPM')
  await expect(page.getByTestId('miser-key-key_e2e_001')).toContainText('$50.00')
  await expect(page.getByTestId('miser-key-key_e2e_001')).toContainText('$1.2500')
  await expect(page.getByTestId('spend-attribution')).toContainText('$1.2500')

  await expect(page.getByTestId('miser-audit')).toContainText('intact · 12 entries')
  await expect(page.getByTestId('miser-cache')).toContainText('healthy')
  await expect(page.getByTestId('miser-providers')).toContainText('primary')

  await page.getByTestId('miser-open-quota').click()
  await page.getByTestId('quota-key').fill('key_e2e_001')
  await page.getByTestId('quota-tiers').fill('simple,hard')
  await page.getByTestId('quota-rpm').fill('240')
  await page.getByTestId('quota-budget').fill('100')
  await page.getByTestId('quota-submit').click()
  await expect(page.getByText('Quotas updated for key_e2e_001.')).toBeVisible()

  await page.getByTestId('miser-open-create').click()
  await page.getByTestId('miser-owner').fill('expiring-agent')
  await page.getByTestId('miser-tiers').fill('reasoning')
  await page.getByTestId('miser-expires').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  await page.getByTestId('miser-create').click()
  await expect(page.getByText('Key provisioned.')).toBeVisible()
})
