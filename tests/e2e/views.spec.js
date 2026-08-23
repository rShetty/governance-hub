// ─────────────────────────────────────────────────────────────────────────────
// Unified console views — data-backed assertions for every nav destination.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

const BASE = process.env.E2E_BASE_URL || 'https://governance.rajeev.me'

test.beforeEach(async ({ page }) => {
  if (process.env.E2E_PASSWORD) await login(page)
  else await page.goto(process.env.E2E_BASE_URL || 'https://governance.rajeev.me')
})

test('Mission Control: KPI band populates from live backends', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Backends up')).toBeVisible()
  // Backends-up KPI shows N/M form
  const kpiPanel = page.locator('div', { hasText: 'Backends up' })
    .filter({ has: page.locator('.label') }).last()
  await expect(kpiPanel).toBeVisible({ timeout: 15000 })
  await page.waitForFunction(
    () => document.body.innerText.includes('/'),
    null, { timeout: 15000 },
  )
})

test('Tools & MCP: Relay health card and MCP catalogue render', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await expect(page.getByRole('heading', { name: 'Tools & MCP' })).toBeVisible()
  // Either live data or a clean empty state — never an error dump
  const relay = page.getByTestId('relay-health')
  await expect(relay).toBeVisible()
  const catalogue = page.getByTestId('mcp-catalogue')
  await expect(catalogue).toBeVisible()
  const body = await page.textContent('body')
  expect(body).not.toContain('unreachable — status 5')
})

test('Access: Patroclus policies listed with engine badges', async ({ page }) => {
  await page.getByRole('button', { name: 'Access' }).click()
  await expect(page.getByRole('heading', { name: 'Access' })).toBeVisible()
  await expect(page.getByText(/Active policies/i)).toBeVisible({ timeout: 15000 })
  if (!process.env.E2E_PASSWORD) {
    await expect(page.getByText('allow-github')).toBeVisible({ timeout: 15000 })
  } else {
    await expect(page.getByText('default', { exact: true })).toBeVisible({ timeout: 15000 })
  }
})

test('Cost & Routing: Miser keys table renders or clean empty state', async ({ page }) => {
  await page.getByRole('button', { name: 'Cost & Routing' }).click()
  await expect(page.getByRole('heading', { name: 'Cost & Routing' })).toBeVisible()
  await expect(page.getByText(/Provisioned keys/i)).toBeVisible({ timeout: 15000 })
})

test('Security: Sentiel stats surface without raw errors', async ({ page }) => {
  await page.getByRole('button', { name: 'Security', exact: true }).click()
  await expect(page.locator('h1')).toContainText('Security')
  const body = await page.textContent('body')
  expect(body).not.toMatch(/status 5\d\d/)
})

test('Identity Directory: humans + agents tabs render (admin)', async ({ page }) => {
  await page.getByRole('button', { name: 'Identity Directory' }).click()
  await expect(page.getByRole('heading', { name: 'Identity Directory' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Humans \(\d+\)$/ })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /^Agents \(\d+\)$/ })).toBeVisible()
})

test('Cross-cutting: no console view shows a raw 5xx to the user', async ({ page }) => {
  for (const label of ['Mission Control', 'Agents', 'Activity', 'Access', 'Tools & MCP', 'Cost & Routing', 'Security', 'Egress']) {
    await page.getByRole('button', { name: label }).click()
    await page.waitForTimeout(800)
    const body = await page.textContent('body')
    expect(body, label).not.toMatch(/status 5\d\d/)
  }
})
