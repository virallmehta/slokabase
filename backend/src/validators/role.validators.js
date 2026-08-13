import { z } from 'zod';

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).nullable().optional(),
});
