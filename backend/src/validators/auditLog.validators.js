import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  query: z.object({
    search: z.string().trim().max(255).optional(),
    actorId: z.coerce.number().int().positive().optional(),
    entityType: z.string().max(50).optional(),
    action: z.string().max(50).optional(),
    dateFrom: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    dateTo: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    // Same 500 ceiling as Users' list (see backend/src/validators/user.validators.js)
    // — caps a single query while covering the frontend's "All" rows-per-page option.
    limit: z.coerce.number().int().min(1).max(500).optional().default(25),
  }),
  body: z.unknown().optional(),
  params: z.unknown().optional(),
});
