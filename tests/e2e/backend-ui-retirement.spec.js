import { test, expect } from '@playwright/test'

test('Hub does not expose external service UI links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()

  const externalLinks = await page.locator('a[href^="http"]').evaluateAll((links) =>
    links.map((link) => link.href).filter((href) => !href.startsWith(page.origin())),
  )
  expect(externalLinks).toEqual([])
})

test('The backend fleet is not surfaced in the console UI', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Service Registry' })).toHaveCount(0)
  await expect(page.getByText('Backend fleet')).toHaveCount(0)
  await expect(page.getByTestId('service-open')).toHaveCount(0)
})
