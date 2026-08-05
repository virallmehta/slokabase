import { Router } from 'express';
import * as auditLogController from './controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { validate } from '#middleware/validate.js';
import { listAuditLogsSchema } from './validators.js';

const router = Router();

// Registered before '/' isn't required (different path, no collision),
// kept here just to sit next to its sibling.
router.get('/filter-options', authenticate, authorize('audit:read'), auditLogController.getFilterOptions);
router.get(
  '/',
  authenticate,
  authorize('audit:read'),
  validate(listAuditLogsSchema),
  auditLogController.listAuditLogs
);

export default router;
