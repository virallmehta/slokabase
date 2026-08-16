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

test('the last admin\'s own detail page hides Delete and shows Role/Status as read-only', async ({ page }) => {
  await loginAsAdmin(page)

  // Navigate the same way a real user would — through the Users list —
  // rather than guessing the admin's id, so this also exercises the
  // real row-click navigation.
  await page.goto('/users')
  await page.getByText(ADMIN_EMAIL).click()
  await page.waitForURL(/\/users\/\d+$/)

  // Delete must not be present at all for this account.
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)

  // The "Last admin" badge (only rendered when isLastAdmin is true).
  await expect(page.getByText('Last admin')).toBeVisible()

  // Role: no editable Select/combobox, just the read-only badge + explanation.
  await expect(page.getByText("This is the only admin account — it can't be reassigned to another role.")).toBeVisible()

  // Status: same — no editable Select/combobox, just the read-only badge + explanation.
  await expect(page.getByText("This is the only admin account — it can't be suspended.")).toBeVisible()

  // Belt-and-suspenders: confirm there is no combobox trigger anywhere in
  // the Role/Status area of the form (shadcn's Select renders as a
  // role="combobox" button) — the Details card has no other Select uses,
  // so zero comboboxes on this page confirms both fields are read-only.
  await expect(page.getByRole('combobox')).toHaveCount(0)
})
