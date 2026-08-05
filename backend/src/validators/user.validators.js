import { z } from 'zod';

// Wrapped under { query } for the `validate()` middleware (see
// middleware/validate.js), which parses req.body/query/params together —
// unlike `validateBody`, this is the one route in this family that
// actually needs query validation (search/filter/pagination), not just
// body validation.
export const listUsersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(255).optional(),
    role: z.string().max(50).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    // 500 caps a single query while still comfortably covering the "All"
    // rows-per-page option the admin Users list offers (see frontend's
    // MAX_USERS_PAGE_SIZE in userService.ts, which must match this).
    limit: z.coerce.number().int().min(1).max(500).optional().default(20),
  }),
  body: z.unknown().optional(),
  params: z.unknown().optional(),
});

// Admin editing ANOTHER user's record. `roleKey` is accepted here but
// gated further inside the controller — only callers holding roles:manage
// may actually change it (see user.controller.js's updateUser).
export const adminUpdateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().max(255).optional(),
  roleKey: z.string().max(50).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

// Admin creating a user directly (see user.controller.js's createUser) —
// no password field, a random temporary one is generated server-side.
export const createUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  roleKey: z.string().max(50).optional(),
});
