import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()
})

test('Task-based shell supports deep links, back, and active navigation', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page).toHaveURL(/\/tools$/)
  await expect(page.getByRole('button', { name: 'Tools & MCP' })).toHaveAttribute('aria-current', 'page')

  await page.goto('/access')
  await expect(page.getByRole('heading', { level: 1, name: 'Access' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/tools$/)
})

test('Command palette navigates and skip link is available', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByPlaceholder('Search pages and actions…').fill('compliance')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/compliance$/)

  await page.reload()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
})

test('Mission Control exposes prioritized and actionable dashboard', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Attention required' })).toBeVisible()
  await expect(page.locator('[data-testid="attention-required"] .attention-item').first()).toBeVisible()
  await expect(page.getByTestId('kpi-backends-up')).toBeVisible()

  await page.getByRole('button', { name: 'Install MCP server' }).click()
  await expect(page).toHaveURL(/\/tools$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tools & MCP' })).toBeVisible()
})

test('Dangerous session kill uses an accessible confirmation dialog', async ({ page }) => {
  await page.goto('/access')
  await page.reload()
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Access', exact: true }).click()
  await expect(page.getByTestId('live-sessions')).toBeVisible()
  const sessionId = 'ses_e2e_001'
  const killButton = page.getByTestId(`kill-${sessionId}`)
  await killButton.click()
  const dialog = page.getByTestId('hub-modal')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(sessionId)
  await expect(page.getByTestId('confirm-action')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('Core pages have no critical accessibility violations', async ({ page }, testInfo) => {
  for (const path of ['/', '/tools', '/access']) {
    await page.goto(path)
    await expect(page.getByRole('main', { name: '' })).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
  }
})
