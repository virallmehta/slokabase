import { describe, it, expect } from 'vitest'
import {
  forgotPasswordSchema,
  resetPasswordFormSchema,
  loginSchema,
  registerSchema,
} from '@/validators/auth.validators'

describe('forgotPasswordSchema (Forgot Password form)', () => {
  it('rejects a missing email', () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false)
  })

  it('rejects an empty-string email', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false)
  })

  it('rejects a malformed email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })

  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true)
  })
})

describe('resetPasswordFormSchema (Reset Password form)', () => {
  it('rejects a new password under 8 characters', () => {
    const result = resetPasswordFormSchema.safeParse({
      newPassword: 'short1',
      confirmPassword: 'short1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when confirmPassword is missing', () => {
    const result = resetPasswordFormSchema.safeParse({ newPassword: 'longenough123' })
    expect(result.success).toBe(false)
  })

  it("rejects when newPassword and confirmPassword don't match, flagging confirmPassword", () => {
    const result = resetPasswordFormSchema.safeParse({
      newPassword: 'longenough123',
      confirmPassword: 'somethingElse123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
      expect(result.error.issues[0].message).toBe("Passwords don't match")
    }
  })

  it('rejects a password over 255 characters', () => {
    const tooLong = 'a'.repeat(256)
    const result = resetPasswordFormSchema.safeParse({
      newPassword: tooLong,
      confirmPassword: tooLong,
    })
    expect(result.success).toBe(false)
  })

  it('accepts matching, sufficiently long passwords', () => {
    const result = resetPasswordFormSchema.safeParse({
      newPassword: 'aBrandNewPassword123',
      confirmPassword: 'aBrandNewPassword123',
    })
    expect(result.success).toBe(true)
  })

  it('does not require or accept a token field — that comes from the URL, not the form', () => {
    const result = resetPasswordFormSchema.safeParse({
      newPassword: 'aBrandNewPassword123',
      confirmPassword: 'aBrandNewPassword123',
      token: 'should-be-ignored',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('token')
    }
  })
})

// Sanity check that adding the new schemas didn't disturb the existing
// login/register schemas they sit alongside in the same module.
describe('existing auth schemas remain unaffected', () => {
  it('loginSchema still accepts a valid login payload', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true)
  })

  it('registerSchema still rejects a short password', () => {
    const result = registerSchema.safeParse({
      name: 'A User',
      email: 'user@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })
})
