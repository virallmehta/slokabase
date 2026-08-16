import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '#config/constants.js';

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
    // Shared with every other paginated endpoint — see
    // backend/src/config/constants.js. Frontend's MAX_USERS_PAGE_SIZE
    // (userService.ts) must stay in sync with MAX_PAGE_SIZE.
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
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
