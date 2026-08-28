import { Router } from 'express';
import * as approvalController from './controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import { createApprovalSchema, transitionSchema } from './validators.js';

const router = Router();

router.get('/', authenticate, authorize('example-approvals:read'), approvalController.listApprovals);
router.get('/:id', authenticate, authorize('example-approvals:read'), approvalController.getApproval);
router.get(
  '/:id/transitions',
  authenticate,
  authorize('example-approvals:read'),
  approvalController.listAvailableTransitions
);
router.post(
  '/',
  authenticate,
  authorize('example-approvals:write'),
  verifyCsrfToken,
  validateBody(createApprovalSchema),
  approvalController.createApproval
);
router.post(
  '/:id/transition',
  authenticate,
  authorize('example-approvals:write'),
  verifyCsrfToken,
  validateBody(transitionSchema),
  approvalController.transitionApproval
);

export default router;
