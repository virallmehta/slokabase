import { z } from 'zod'

// Mirrors backend/src/validators/auth.validators.js's updateProfileSchema
// and backend/src/validators/user.validators.js's adminUpdateUserSchema.

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255).optional(),
  email: z.string().email('Enter a valid email address').max(255).optional(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(255),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const adminUpdateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255).optional(),
  email: z.string().email('Enter a valid email address').max(255).optional(),
  roleKey: z.string().optional(),
  status: z.enum(['active', 'suspended']).optional(),
})
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  email: z.string().email('Enter a valid email address').max(255),
  roleKey: z.string().optional(),
})
export type CreateUserInput = z.infer<typeof createUserSchema>
