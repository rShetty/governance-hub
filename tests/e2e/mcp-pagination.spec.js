import { test, expect } from '@playwright/test'

test('MCP catalog paginates large server lists and supports search', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tools & MCP' }).click()

  // Verify table is visible and has servers
  const table = page.getByTestId('mcp-table')
  await expect(table).toBeVisible({ timeout: 10000 })

  // Count total rows on page 1 — should be capped at PAGE_SIZE (20)
  const pageOneRows = await table.locator('tbody tr').count()
  expect(pageOneRows).toBeLessThanOrEqual(20)

  // If there are enough servers to paginate, verify pagination controls exist
  const pagination = page.getByTestId('mcp-pagination')
  const paginationVisible = await pagination.isVisible().catch(() => false)

  if (paginationVisible) {
    // Verify pagination text shows page info
    await expect(pagination).toContainText(/Page 1 of \d+/)
    await expect(pagination).toContainText(/total/)

    // Navigate to page 2
    await page.getByTestId('mcp-page-next').click()
    await expect(pagination).toContainText(/Page 2 of/)

    // Navigate back to page 1
    await page.getByTestId('mcp-page-prev').click()
    await expect(pagination).toContainText(/Page 1 of/)

    // Prev button should be disabled on page 1
    await expect(page.getByTestId('mcp-page-prev')).toBeDisabled()
  }

  // Test search filtering
  await page.getByTestId('mcp-search').fill('inference')
  await expect(page.getByTestId('mcp-table')).toContainText('inference.sh', { timeout: 5000 })

  // Clear search
  await page.getByTestId('mcp-search').clear()

  // Search for something that doesn't exist
  await page.getByTestId('mcp-search').fill('zzz-nonexistent-server-xyz')
  await expect(page.locator('[data-testid="mcp-table"] tbody tr')).toHaveCount(0)

  // Clear again
  await page.getByTestId('mcp-search').clear()
  const rowsAfterClear = await table.locator('tbody tr').count()
  expect(rowsAfterClear).toBeGreaterThan(0)
})
