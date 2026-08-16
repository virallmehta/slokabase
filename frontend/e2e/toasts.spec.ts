import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'

// sonner renders each toast inside a [data-sonner-toast] region — scoping
// assertions to it (rather than a bare getByText anywhere on the page)
// confirms the message actually came from a toast, not some other banner.
function toast(page: import('@playwright/test').Page, text: string | RegExp) {
  return page.locator('[data-sonner-toast]').getByText(text)
}

test.describe('sonner toast migration', () => {
  test('login error shows a toast, not an inline banner', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill('definitely-the-wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(toast(page, 'Invalid email or password')).toBeVisible()
    // The old inline Alert markup must be gone — no [role="alert"] banner
    // duplicating what the toast already says.
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
  })

  test('register success shows a toast and lands on the dashboard', async ({ page }) => {
    const email = `e2e-toast-register-${Date.now()}@example.com`
    await page.goto('/register')
    await page.getByLabel(/name/i).fill('E2E Toast Register')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(toast(page, 'Account created — welcome!')).toBeVisible()
    await page.waitForURL('**/dashboard')
  })

  test('forgot password submit shows a toast confirmation', async ({ page }) => {
    // A disposable, never-registered address on purpose — the backend
    // gives the same generic response either way (see auth.controller.js),
    // and this avoids generating a real reset email for the shared admin
    // account that a later test could pick up by mistake (see the Mailpit
    // lookup below, which is scoped per-recipient for the same reason).
    await page.goto('/forgot-password')
    await page.getByLabel(/email/i).fill(`e2e-toast-forgot-${Date.now()}@example.com`)
    await page.getByRole('button', { name: /send reset link/i }).click()

    await expect(
      toast(page, 'If an account with that email exists, a password reset link has been sent.')
    ).toBeVisible()
    // The success view no longer has its own inline Alert repeating this.
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
  })

  test('reset password success shows a toast on the login page it redirects to', async ({ page, request }) => {
    // Create a disposable user and mint a real reset token for them
    // server-side (mirrors what clicking the emailed link would give us)
    // — avoids needing to read a real inbox in this environment.
    const email = `e2e-toast-reset-${Date.now()}@example.com`
    const registerRes = await request.post('http://localhost:3000/api/v1/auth/register', {
      data: { name: 'E2E Toast Reset', email, password: 'password123' },
    })
    expect(registerRes.ok()).toBeTruthy()

    const forgotRes = await request.post('http://localhost:3000/api/v1/auth/forgot-password', {
      data: { email },
    })
    expect(forgotRes.ok()).toBeTruthy()

    // The token itself is only ever known in plaintext at issuance (the DB
    // stores just its SHA-256 hash — see tokenService.js), and the real
    // delivery channel is an email this environment doesn't have an inbox
    // to read from. Pull it from the dev SMTP catch-all (Mailpit) instead
    // of asserting against a guessed value. Mailpit is a shared catch-all
    // across every test/manual run against this backend, so filter
    // client-side on an exact recipient match rather than trusting a
    // server-side search query to scope correctly — a loose match here
    // previously picked up an unrelated account's reset email.
    const listRes = await request.get('http://localhost:8025/api/v1/messages?limit=25')
    test.skip(!listRes.ok(), 'Mailpit not reachable at localhost:8025 — start it to run this spec')
    const { messages } = await listRes.json()
    const match = messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((recipient) => recipient.Address === email)
    )
    expect(match, `no Mailpit message found addressed to ${email}`).toBeTruthy()
    const messageRes = await request.get(`http://localhost:8025/api/v1/message/${match.ID}`)
    const { Text: body } = await messageRes.json()
    const token = /token=([^\s&]+)/.exec(body)?.[1]
    expect(token).toBeTruthy()

    await page.goto(`/reset-password?token=${token}`)
    await page.getByLabel('New password', { exact: true }).fill('newpassword456')
    await page.getByLabel('Confirm new password').fill('newpassword456')
    await page.getByRole('button', { name: /reset password/i }).click()

    await page.waitForURL('**/login')
    await expect(toast(page, 'Your password has been reset. Sign in with your new password.')).toBeVisible()
  })

  test('settings save shows a toast', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/dashboard')

    await page.goto('/settings')
    const appNameInput = page.locator('#app_name')
    await expect(appNameInput).toBeVisible()
    const original = await appNameInput.inputValue()

    try {
      await appNameInput.fill(`${original} `) // trivial, reversible change
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(toast(page, 'Changes saved.')).toBeVisible()
      await expect(page.locator('[role="alert"]')).toHaveCount(0)
    } finally {
      await appNameInput.fill(original)
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(toast(page, 'Changes saved.')).toBeVisible()
    }
  })
})
