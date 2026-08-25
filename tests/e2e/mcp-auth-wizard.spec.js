import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto('/')
  await expect(page.getByText('administrator')).toBeVisible()
})

test('Install wizard shows auth type selector with OAuth options', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await expect(page.getByTestId('wiz-auth-type')).toBeVisible()

  await page.getByTestId('wiz-auth-type').selectOption('oauth')
  await expect(page.getByTestId('wiz-client-id')).toBeVisible()
  await expect(page.getByTestId('wiz-client-secret')).toBeVisible()
  await expect(page.getByTestId('wiz-scopes')).toBeVisible()

  await page.getByTestId('wiz-auth-type').selectOption('none')
  await expect(page.getByTestId('wiz-client-id')).toBeHidden()
})

async function installWithOAuth(page, name, url) {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await page.getByTestId('wiz-name').fill(name)
  await page.getByTestId('wiz-url').fill(url)
  await page.getByTestId('wiz-auth-type').selectOption('oauth')
  if (url.endsWith('/cimd')) {
    await page.getByTestId('wiz-client-id').fill('atlassian-cimd-client')
    await page.getByTestId('wiz-client-secret').fill('atlassian-cimd-secret')
  }
  await page.getByTestId('wiz-next-1').click()
  const authPatch = page.waitForResponse((response) =>
    response.request().method() === 'PATCH' && /\/api\/bff\/mcp\/[^/]+$/.test(response.url())
  )
  await page.getByTestId('wiz-install-btn').click()
  await expect(page.getByTestId('wiz-installed-ok')).toBeVisible({ timeout: 10000 })
  expect((await authPatch).status()).toBe(200)
  await page.getByTestId('wiz-next-2').click()
  // Skip OAuth connect
  await expect(page.getByTestId('wiz-oauth-connect-btn')).toBeVisible({ timeout: 5000 })
  if (!url.endsWith('/cimd') && !url.endsWith('/dcr')) {
    await page.getByRole('button', { name: 'Skip for now' }).click()
  }
}

test('OAuth DCR: configure → install → skip auth → grant → done', async ({ page }) => {
  await installWithOAuth(page, 'atlassian-dcr-test', 'https://mcp.atlassian.com/sse')

  // Grant access to agent
  await page.getByTestId('wiz-agents').fill('agt_e2e_001')
  const grantPromise = page.waitForResponse((r) =>
    r.url().includes('/grant') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Grant access' }).click()
  expect((await grantPromise).status()).toBe(200)

  await expect(page.getByTestId('wiz-done')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('wiz-finish').click()
  await expect(page.getByTestId('install-wizard')).toBeHidden()
})

test('Client credentials: configure with pre-registered creds → done', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('install-mcp-btn').click()
  await page.getByTestId('wiz-name').fill('static-cred-server')
  await page.getByTestId('wiz-url').fill('https://api.example.test/sse')
  await page.getByTestId('wiz-auth-type').selectOption('oauth')
  await page.getByTestId('wiz-client-id').fill('my-client-id-123')
  await page.getByTestId('wiz-client-secret').fill('my-secret-456')
  await page.getByTestId('wiz-scopes').fill('read write')
  await page.getByTestId('wiz-next-1').click()
  await page.getByTestId('wiz-install-btn').click()
  await expect(page.getByTestId('wiz-installed-ok')).toBeVisible({ timeout: 10000 })
  await page.getByTestId('wiz-next-2').click()

  await expect(page.getByTestId('wiz-oauth-connect-btn')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Skip for now' }).click()

  await page.getByTestId('wiz-agents').fill('agt_e2e_001')
  const grantPromise = page.waitForResponse((r) =>
    r.url().includes('/grant') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Grant access' }).click()
  expect((await grantPromise).status()).toBe(200)

  await expect(page.getByTestId('wiz-done')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('wiz-finish').click()
})

test('MCP OAuth resolves CIMD before DCR', async ({ page }) => {
  await installWithOAuth(page, 'cimd-atlassian', 'https://mcp.atlassian.com/cimd')

  const connectPromise = page.waitForResponse((response) =>
    response.url().includes('/oauth/connect') && response.request().method() === 'GET'
  )
  await page.getByTestId('wiz-oauth-connect-btn').click()
  expect((await connectPromise).status()).toBe(200)

  const popupPromise = page.waitForEvent('popup')
  const popup = await popupPromise
  expect(popup.url()).toContain('client_id=atlassian-cimd-client')
  expect(popup.url()).toContain('hub_oauth_mode=cimd')
  await popup.close()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
})

test('MCP OAuth falls back to DCR when no client ID is supplied', async ({ page }) => {
  await installWithOAuth(page, 'dcr-atlassian', 'https://mcp.atlassian.com/dcr')

  const connectPromise = page.waitForResponse((response) =>
    response.url().includes('/oauth/connect') && response.request().method() === 'GET'
  )
  await page.getByTestId('wiz-oauth-connect-btn').click()
  expect((await connectPromise).status()).toBe(200)

  const popupPromise = page.waitForEvent('popup')
  const popup = await popupPromise
  expect(popup.url()).toContain('hub_oauth_mode=dcr')
  await popup.close()
  await expect(page.getByTestId('install-wizard')).toBeVisible()
})
