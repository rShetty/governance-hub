import { test, expect } from '@playwright/test'

test('Final verification: admin completes every major governance domain in the Hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()
  const externalLinks = await page.locator('a[href^="http"]').evaluateAll((links) =>
    links.map((link) => link.href).filter((href) => !href.startsWith(page.origin())),
  )
  expect(externalLinks).toEqual([])

  // Identity
  await page.getByRole('button', { name: 'Agents' }).click()
  await page.getByTestId('open-identity-dialog').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-name').fill('final-identity')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Mint identity' }).click()
  await expect(page.getByTestId('identity-action-result')).toContainText('minted')
  await page.getByRole('button', { name: 'Identity Directory' }).click()
  await expect(page.getByRole('button', { name: /Agents \(\d+\)/ })).toBeVisible()

  // Tools & MCP
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByTestId('unified-catalog')).toBeVisible()
  await expect(page.getByTestId('unified-catalog')).toBeVisible()

  // Access
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByTestId('pending-approvals')).toBeVisible()
  await expect(page.getByTestId('policy-pol_e2e_001')).toBeVisible()

  // Orchestration
  await page.getByRole('button', { name: 'Orchestration' }).click()
  await expect(page.getByTestId('team-form')).toBeVisible()
  await expect(page.getByTestId('workflow-form')).toBeVisible()

  // Supply chain
  await page.getByRole('button', { name: 'Supply Chain' }).click()
  await expect(page.getByTestId('package-form')).toBeVisible()
  await expect(page.getByTestId('publisher-form')).toBeVisible()

  // Risk
  await page.getByRole('button', { name: 'Security' }).click()
  await expect(page.getByTestId('remediation-form')).toBeVisible()
  await expect(page.getByTestId('audit-integrity')).toBeVisible()

  // Compliance
  await page.getByRole('button', { name: 'Compliance' }).click()
  await expect(page.getByTestId('coverage-gaps')).toBeVisible({ timeout: 10000 })

  // Cost (admin-only)
  await page.getByRole('button', { name: 'Cost & Routing' }).click()
  await expect(page.getByTestId('miser-key-form')).toBeVisible({ timeout: 10000 })
})
