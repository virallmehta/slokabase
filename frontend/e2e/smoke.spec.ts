import { test, expect } from '@playwright/test'

// Proves the Playwright setup itself works — loads the login page (no
// backend auth required to reach it) and checks the form renders. Actual
// feature verification (login flow, admin pages, etc.) belongs in
// dedicated spec files; this one exists purely so a broken Playwright
// install/config fails fast and obviously.
test('login page renders the email/password form', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByLabel(/email/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /log in|sign in/i })).toBeVisible()
})
