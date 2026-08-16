import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '#config/constants.js';

export const listAuditLogsSchema = z.object({
  query: z.object({
    search: z.string().trim().max(255).optional(),
    actorId: z.coerce.number().int().positive().optional(),
    entityType: z.string().max(50).optional(),
    action: z.string().max(50).optional(),
    dateFrom: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    dateTo: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    // Shared with every other paginated endpoint — see
    // backend/src/config/constants.js.
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  }),
  body: z.unknown().optional(),
  params: z.unknown().optional(),
});
