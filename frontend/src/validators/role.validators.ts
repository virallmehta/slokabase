import { z } from 'zod'

// Mirrors backend/modules/roles/validators.js's createRoleSchema/updateRoleSchema.

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(255).optional(),
})
export type CreateRoleInput = z.infer<typeof createRoleSchema>

export const updateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(255).optional(),
})
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
