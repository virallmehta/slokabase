import { z } from 'zod'

// Mirrors backend/src/validators/auth.validators.js on purpose — client-side
// validation is a UX nicety only, the backend re-validates everything.
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  email: z.string().email('Enter a valid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(255),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// Only the form fields — the reset token itself comes from the URL query
// param, not user input, so it isn't part of this schema (see
// ResetPassword.tsx). Same shape/rule as user.validators.ts's
// changePasswordSchema minus currentPassword (there's no current password
// to verify in the forgot-password flow).
export const resetPasswordFormSchema = z
  .object({
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(255),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>
