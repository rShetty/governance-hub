import { test, expect } from '@playwright/test'

test('Install wizard: admin walks through all four steps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('install-mcp-btn')).toBeVisible()

  // Open wizard
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
  await expect(page.getByTestId('wizard-stepper')).toContainText('Configure')

  // Step 1: Configure
  await page.getByTestId('wiz-name').fill('wizard-test-server')
  await page.getByTestId('wiz-url').fill('https://mcp.wizard.test/sse')
  await page.getByTestId('wiz-next-1').click()

  // Step 2: Install
  await expect(page.getByText(/Ready to install/)).toBeVisible()
  await page.getByTestId('wiz-install-btn').click()
  await expect(page.getByTestId('wiz-installed-ok')).toBeVisible({ timeout: 10000 })
  await page.getByTestId('wiz-next-2').click()

  // Step 3: Authorize
  await page.getByTestId('wiz-agents').fill('agt_e2e_001')
  await page.getByTestId('wiz-authorize-btn').click()

  // Step 4: Done
  await expect(page.getByTestId('wiz-done')).toBeVisible({ timeout: 10000 })
  await page.getByTestId('wiz-finish').click()
  await expect(page.getByTestId('install-wizard')).toBeHidden()

  // Server appears in catalog
  await expect(page.getByTestId('mcp-table')).toContainText('wizard-test-server')
})

test('Install wizard close button dismisses without installing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('install-wizard')).toBeVisible()

  await page.locator('[data-testid="install-wizard"] button:has-text("✕")').click()
  await expect(page.getByTestId('install-wizard')).toBeHidden()
})
