import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'

test('a password_change audit entry shows "Password was changed." instead of the generic no-diff message', async ({
  page,
  request,
}) => {
  // Generate a real password_change audit entry via a throwaway user's
  // own self-service password change (PATCH /users/me/password) — the
  // same action user.controller.js logs with no field-level diff.
  const email = `e2e-audit-pwchange-${Date.now()}@example.com`
  const registerRes = await request.post('http://localhost:3000/api/v1/auth/register', {
    data: { name: 'E2E Audit Password Change', email, password: 'password123' },
  })
  expect(registerRes.ok()).toBeTruthy()

  const loginRes = await request.post('http://localhost:3000/api/v1/auth/login', {
    data: { email, password: 'password123' },
  })
  expect(loginRes.ok()).toBeTruthy()
  const cookies = (await request.storageState()).cookies
  const csrf = cookies.find((c) => c.name === 'csrf_token')?.value
  expect(csrf).toBeTruthy()

  const changeRes = await request.patch('http://localhost:3000/api/v1/users/me/password', {
    headers: { 'X-CSRF-Token': csrf! },
    data: { currentPassword: 'password123', newPassword: 'password456' },
  })
  expect(changeRes.ok()).toBeTruthy()

  // Now view it as admin through the actual Audit Log page.
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard')

  await page.goto('/audit-log')
  await page.getByPlaceholder(/search/i).fill('E2E Audit Password Change')
  const row = page.getByRole('row', { name: /password change/i }).first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: /view details/i }).click()

  await expect(page.getByText('Password was changed.', { exact: true })).toBeVisible()
  await expect(page.getByText('No field-level changes recorded for this action.')).toHaveCount(0)
})
