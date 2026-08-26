import { test, expect } from '@playwright/test'

test('Operators issue and revoke Patroclus delegations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Access', exact: true }).click()

  await page.getByTestId('select-agent_id').selectOption('agt_e2e_001')
  await page.getByPlaceholder('relay:call,miser:route').fill('relay:call')
  await page.getByTestId('delegation-submit').click()
  await expect(page.getByTestId('toast-success')).toContainText('Delegation grant_e2e_001 issued.')

  await page.getByRole('button', { name: 'Revoke grant' }).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-grant_id').fill('grant_e2e_001')
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(page.getByTestId('hub-modal')).toBeHidden()
  await expect(page.getByText('Grant grant_e2e_001 revoked.')).toBeVisible()
})
