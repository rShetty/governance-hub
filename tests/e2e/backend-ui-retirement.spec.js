import { test, expect } from '@playwright/test'

test('Hub does not expose external service UI links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()

  const externalLinks = await page.locator('a[href^="http"]').evaluateAll((links) =>
    links.map((link) => link.href).filter((href) => !href.startsWith(page.origin())),
  )
  expect(externalLinks).toEqual([])
})

test('Service registry labels product UI paths as internal-only', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Service Registry' }).click()
  await page.getByTestId('service-open').click()

  await expect(page.getByText(/UI path \(developer-only, never linked\)/)).toBeVisible()
  await expect(page.getByText(/product frontends are internal only/)).toBeVisible()
})
