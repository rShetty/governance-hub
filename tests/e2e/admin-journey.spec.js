import { test, expect } from '@playwright/test'

test('Admin signs in and completes the governance onboarding journey', async ({ page }) => {
  await page.goto('/')

  // Admin is authenticated and sees the control plane.
  await expect(page.getByText('Local E2E Admin')).toBeVisible()
  await expect(page.getByText('administrator')).toBeVisible()

  // 1. Create a runtime agent.
  await page.getByRole('button', { name: 'Agents' }).click()
  await page.getByTestId('runtime-name').fill('journey-agent')
  await page.getByTestId('runtime-endpoint').fill('https://agent.example.test')
  await page.getByTestId('runtime-submit').click()
  await expect(page.getByTestId('identity-action-result')).toContainText('registered.')

  // The runtime roster reflects the newly created actor.
  const runtime = page.getByTestId('runtime-agents')
  await expect(runtime).toBeVisible()

  // 2. Install an MCP server.
  await page.getByRole('button', { name: 'Tools & MCP' }).click()
  await page.getByTestId('toggle-mcp-form').click()
  await page.getByTestId('mcp-name').fill('journey-mcp')
  await page.getByTestId('mcp-transport').selectOption('sse')
  await page.getByTestId('mcp-url').fill('https://mcp.example.test/sse')
  await page.getByTestId('mcp-description').fill('Admin journey server')
  await page.getByTestId('mcp-submit').click()
  await expect(page.getByTestId('mcp-table')).toContainText('journey-mcp')

  // 3. Associate the MCP server with the machine identity.
  page.once('dialog', dialog => dialog.accept('agt_e2e_001'))
  const journeyRow = page.getByTestId('mcp-table').locator('tr', { hasText: 'journey-mcp' }).first()
  await journeyRow.getByRole('button', { name: 'Grant → agent' }).click()
  await expect(journeyRow).toBeVisible()
  await journeyRow.getByRole('button', { name: 'Who has it?' }).click()
  await expect(page.getByTestId('access-list')).toContainText('agt_e2e_001')

  // 4. Create and verify a security policy.
  const policyName = `journey-policy-${Date.now().toString(36)}`
  const response = await page.request.post('/api/bff/policies', {
    data: {
      name: policyName,
      engine: 'yaml',
      definition: '- name: allow-github\n  actions: ["call"]\n  resources: ["mcp/*"]\n  decision: allow',
    },
  })
  expect(response.status()).toBe(201)

  await page.getByRole('button', { name: 'Access' }).click()
  const policyRow = page.locator('tr', { hasText: policyName }).first()
  await expect(policyRow).toBeVisible({ timeout: 10000 })
  await policyRow.getByRole('button', { name: 'Inspect' }).click()
  await expect(page.getByText(new RegExp(`Policy ${policyName}:`))).toBeVisible()

  // 5. Simulate enforcement before relying on it.
  await page.getByTestId('simulate-action').fill('call')
  await page.getByTestId('simulate-resource').fill('mcp/github')
  await page.getByTestId('simulate-yaml').fill('- name: allow-call\n  actions: ["call"]\n  resources: ["mcp/*"]\n  decision: allow')
  await page.getByTestId('simulate-run').click()
  await expect(page.getByTestId('simulation-result')).toContainText('"decision": "allow"')

  // 6. Security posture: acknowledge alert, verify runtime, check residency.
  await page.getByRole('button', { name: 'Security' }).click()
  await expect(page.getByText('Spending spike detected')).toBeVisible()
  await page.getByTestId('acknowledge-alert_e2e_001').click()
  await expect(page.getByText('Alert acknowledged.')).toBeVisible()

  await page.getByTestId('attestation-agent').fill('agt_e2e_001')
  await page.getByTestId('attestation-hash').fill('valid-hash')
  await page.getByTestId('verify-attestation').click()
  await expect(page.getByText('Attestation verified.')).toBeVisible()

  await page.getByTestId('geo-destination').fill('api.example.test')
  await page.getByTestId('check-geo').click()
  await expect(page.getByText('Geo verdict for api.example.test: allowed')).toBeVisible()
})
