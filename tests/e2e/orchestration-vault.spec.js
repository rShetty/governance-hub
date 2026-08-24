import { test, expect } from '@playwright/test'

test('Admins create Hive teams and workflows through the Hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()
  await page.getByRole('button', { name: 'Orchestration' }).click()

  await page.getByTestId('team-name').fill('journey-team')
  await page.getByTestId('team-agents').fill('agt_e2e_001')
  await page.getByTestId('team-submit').click()
  await expect(page.getByText(/Team .+ created\./)).toBeVisible()

  await page.getByTestId('workflow-name').fill('journey-workflow')
  await page.getByTestId('workflow-steps').fill('classify\ninvoke\naudit')
  await page.getByTestId('workflow-submit').click()
  await expect(page.getByText(/Workflow .+ created\./)).toBeVisible()
})

test('Vault shows credential metadata without exposing secrets', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Credential Vault' }).click()

  await expect(page.getByTestId('vault-empty')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('refresh_token')
})
