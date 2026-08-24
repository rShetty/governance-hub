import { test, expect } from '@playwright/test'

test('Unified catalog paginates large lists and supports search', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  const table = page.getByTestId('catalog-table')
  await expect(table).toBeVisible({ timeout: 10000 })

  // Page 1 should show at most CATALOG_PAGE_SIZE rows
  const pageOneRows = await table.locator('tbody tr').count()
  expect(pageOneRows).toBeLessThanOrEqual(20)

  // If pagination is visible, test navigation
  const pagination = page.getByTestId('catalog-pagination')
  if (await pagination.isVisible().catch(() => false)) {
    await expect(pagination).toContainText(/Page 1 of \d+/)

    // Go to page 2
    await page.getByTestId('catalog-page-next').click()
    await expect(pagination).toContainText(/Page 2 of/)

    // Go back
    await page.getByTestId('catalog-page-prev').click()
    await expect(pagination).toContainText(/Page 1 of/)
    await expect(page.getByTestId('catalog-page-prev')).toBeDisabled()
  }

  // Search filtering
  await page.getByTestId('catalog-search').fill('Fixture')
  await expect(table).toContainText('Fixture MCP server', { timeout: 5000 })

  // Search with no match
  await page.getByTestId('catalog-search').fill('zzz-nonexistent-xyz')
  await expect(table.locator('tbody tr')).toHaveCount(0)

  // Clear
  await page.getByTestId('catalog-search').clear()
  const rowsAfterClear = await table.locator('tbody tr').count()
  expect(rowsAfterClear).toBeGreaterThan(0)
})
