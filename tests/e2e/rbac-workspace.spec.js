import { test, expect } from '@playwright/test'

test('Members see assigned workspace without admin-only navigation or 403s', async ({ page }) => {
  await page.goto('/__test__/member')
  await page.goto('/')
  await expect(page.getByText('member')).toBeVisible()
  await expect(page.getByText('administrator')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Service Registry' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Identity Directory' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Cost & Routing' })).toBeHidden()

  await page.getByRole('button', { name: 'My Workspace' }).click()
  await expect(page.getByTestId('my-agents')).toContainText('Fixture Agent')
  await expect(page.getByTestId('my-mcps')).toContainText('Fixture MCP server')

  for (const label of ['Mission Control', 'My Workspace', 'Agents', 'Activity', 'Tools & MCP', 'Supply Chain']) {
    await page.getByRole('button', { name: label }).click()
    await expect(page.getByText(/status 403|admin required/)).toHaveCount(0)
  }
})
