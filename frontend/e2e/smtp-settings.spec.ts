import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'

function toast(page: import('@playwright/test').Page, text: string | RegExp) {
  return page.locator('[data-sonner-toast]').getByText(text)
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard')
}

test.describe('SMTP settings', () => {
  test('Support Email field is gone; Email category shows the SMTP fields with a masked password input', async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto('/settings')

    await expect(page.getByText('Email', { exact: true })).toBeVisible()
    await expect(page.locator('#smtp_host')).toBeVisible()
    await expect(page.locator('#smtp_port')).toBeVisible()
    await expect(page.locator('#smtp_secure')).toBeVisible()
    await expect(page.locator('#smtp_username')).toBeVisible()
    await expect(page.locator('#smtp_from')).toBeVisible()

    // The old field is gone entirely, not just relabeled.
    await expect(page.getByText('Support Email', { exact: true })).toHaveCount(0)
    await expect(page.locator('#support_email')).toHaveCount(0)

    const passwordInput = page.locator('#smtp_password')
    await expect(passwordInput).toBeVisible()
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await expect(passwordInput).toHaveAttribute('placeholder', 'Leave blank to keep current value')
    // Masked server-side too — never pre-filled with a real stored value.
    await expect(passwordInput).toHaveValue('')
  })

  test('Send test email succeeds and shows a toast', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/settings')

    await page.getByRole('button', { name: /send test email/i }).click()
    await expect(toast(page, `Test email sent to ${ADMIN_EMAIL}.`)).toBeVisible({ timeout: 10000 })
  })

  test('invalid smtp_port is rejected with a clear error toast', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/settings')

    const portInput = page.locator('#smtp_port')
    const original = await portInput.inputValue()
    try {
      await portInput.fill('99999')
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(toast(page, /smtp_port.*must be a valid port number/)).toBeVisible()
    } finally {
      await portInput.fill(original)
    }
  })

  test('invalid smtp_from is rejected with a clear error toast', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/settings')

    const fromInput = page.locator('#smtp_from')
    const original = await fromInput.inputValue()
    try {
      await fromInput.fill('not-an-email')
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(toast(page, /smtp_from.*must be a valid email address/)).toBeVisible()
    } finally {
      await fromInput.fill(original)
    }
  })

  test('setting and re-saving smtp_port persists correctly and round-trips', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/settings')

    const portInput = page.locator('#smtp_port')
    const original = await portInput.inputValue()
    try {
      await portInput.fill('2525')
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(toast(page, 'Changes saved.')).toBeVisible()

      await page.reload()
      await expect(page.locator('#smtp_port')).toHaveValue('2525')
    } finally {
      await page.locator('#smtp_port').fill(original)
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(toast(page, 'Changes saved.')).toBeVisible()
    }
  })
})
