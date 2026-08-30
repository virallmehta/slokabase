import { z } from 'zod';
import { isValidState } from '#services/workflowService.js';

export const createApprovalSchema = z.object({
  title: z.string().min(1).max(255),
});

export const transitionSchema = z.object({
  to: z.string().refine((value) => isValidState('example-approval', value), {
    message: 'Not a recognized state for this entity type',
  }),
});
