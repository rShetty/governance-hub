import { test, expect } from '@playwright/test'

const runId = Date.now().toString(36)

test.beforeEach(async ({ page }) => {
  await page.goto('/__test__/admin')
  await page.goto('/')
})

test('Unified actor DTO correlates Hive, Argus, and Patroclus IDs', async ({ page }) => {
  const actorName = `corr-hive-${runId}`
  await page.getByRole('button', { name: 'Agents' }).click()

  // Register a runtime agent (Hive) — also provisions the Patroclus record.
  await page.getByTestId('open-runtime-wizard').click()
  await expect(page.getByTestId('hub-wizard')).toBeVisible()
  await page.getByTestId('runtime-name').fill(actorName)
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('runtime-endpoint').fill('https://corr.example.test')
  await page.getByTestId('wizard-finish').click()
  await expect(page.getByTestId('identity-action-result')).toContainText('registered.')

  // Mint a machine identity with the same name (Argus).
  await page.getByTestId('open-identity-dialog').click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()
  await page.getByTestId('dialog-name').fill(actorName)
  await page.getByTestId('hub-modal').getByRole('button', { name: 'Mint identity' }).click()
  await expect(page.getByTestId('identity-action-result')).toContainText('minted')

  // The unified actor DTO now carries all three IDs.
  const actorsResponse = await page.request.get('/api/bff/actors')
  expect(actorsResponse.status()).toBe(200)
  const { actors } = await actorsResponse.json()
  const actor = actors.find((entry) => entry.name === actorName)
  expect(actor).toBeTruthy()
  expect(actor.hive_id).toMatch(/^agent_/)
  expect(actor.argus_id).toMatch(/^agt_/)
  expect(actor.patroclus_id).toMatch(/^ptr_/)

  // The unified roster shows every correlated ID.
  await expect(page.getByTestId(`actor-row-${actorName}`)).toContainText(actor.hive_id)
  await expect(page.getByTestId(`actor-row-${actorName}`)).toContainText(actor.argus_id)
  await expect(page.getByTestId(`actor-row-${actorName}`)).toContainText(actor.patroclus_id)
})

test('Emergency stop uses the Patroclus ID while selectors use Hive IDs', async ({ page }) => {
  const actorName = `corr-kill-${runId}`
  await page.getByRole('button', { name: 'Agents' }).click()

  await page.getByTestId('open-runtime-wizard').click()
  await expect(page.getByTestId('hub-wizard')).toBeVisible()
  await page.getByTestId('runtime-name').fill(actorName)
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('runtime-endpoint').fill('https://corr.example.test')
  await page.getByTestId('wizard-finish').click()
  await expect(page.getByTestId('identity-action-result')).toContainText('registered.')

  const { actors } = await (await page.request.get('/api/bff/actors')).json()
  const actor = actors.find((entry) => entry.name === actorName)
  expect(actor).toBeTruthy()
  expect(actor.hive_id).toMatch(/^agent_/)
  expect(actor.patroclus_id).toMatch(/^ptr_/)

  await page.getByRole('button', { name: 'Emergency stop' }).click()
  await expect(page.getByTestId('hub-modal')).toBeVisible()

  // The selector is keyed by the Hive runtime agent ID.
  await page.getByTestId('dialog-agent_id').selectOption({ label: actorName })
  expect(await page.getByTestId('dialog-agent_id').inputValue()).toBe(actor.hive_id)
  await page.getByTestId('dialog-reason').fill('contain compromised credentials')
  await page.getByRole('button', { name: 'Apply stop' }).click()

  // The stop was applied to the correlated Patroclus record, not the Hive ID.
  await expect(page.getByTestId('identity-action-result')).toContainText(`Emergency stop applied to ${actor.patroclus_id}`)
  await expect(page.getByTestId('identity-action-result')).not.toContainText(`applied to ${actor.hive_id}`)
})
