import { z } from 'zod';

/**
 * These mirror the frontend's Zod schemas on purpose. Client-side
 * validation is a UX nicety only — anyone can call this API directly with
 * curl/Postman, so the real enforcement has to happen here.
 */
export const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().max(255).optional(),
});
