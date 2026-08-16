import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard')
}

test('saving a new App Name on the Settings page updates the sidebar immediately, no other action needed', async ({
  page,
}) => {
  await loginAsAdmin(page)
  await page.goto('/settings')

  const sidebar = page.locator('[data-slot="sidebar"]')
  const appNameInput = page.locator('#app_name')
  await expect(appNameInput).toBeVisible()

  const originalAppName = await appNameInput.inputValue()
  const newAppName = `E2E Test Name ${Date.now()}`

  try {
    // Sidebar shows the ORIGINAL name before any save — establishes the
    // baseline this test is actually changing.
    await expect(sidebar.getByText(originalAppName, { exact: true })).toBeVisible()

    await appNameInput.fill(newAppName)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()

    // The actual assertion: without navigating away or doing anything
    // else, the sidebar (rendered on this same page, untouched) picks up
    // the new name on its own.
    await expect(sidebar.getByText(newAppName, { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(sidebar.getByText(originalAppName, { exact: true })).toHaveCount(0)
  } finally {
    // Restore the original value so this test doesn't leave the shared
    // dev database's app_name permanently changed.
    await appNameInput.fill(originalAppName)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    await expect(sidebar.getByText(originalAppName, { exact: true })).toBeVisible({ timeout: 5000 })
  }
})
