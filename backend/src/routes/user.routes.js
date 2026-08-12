import { Router } from 'express';
import * as userController from '#controllers/user.controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validate, validateBody } from '#middleware/validate.js';
import { updateProfileSchema, changePasswordSchema } from '#validators/auth.validators.js';
import {
  listUsersSchema,
  adminUpdateUserSchema,
  createUserSchema,
} from '#validators/user.validators.js';

const router = Router();

router.get('/me', authenticate, userController.getProfile);
router.patch(
  '/me',
  authenticate,
  verifyCsrfToken,
  validateBody(updateProfileSchema),
  userController.updateProfile
);
router.patch(
  '/me/password',
  authenticate,
  verifyCsrfToken,
  validateBody(changePasswordSchema),
  userController.changePassword
);

// Admin Users module. List/detail need users:read; edits/creation need
// users:write; deletion needs users:delete — role assignment is gated
// further inside the controller (requires roles:manage too, see
// user.controller.js's createUser/updateUser).
router.get(
  '/',
  authenticate,
  authorize('users:read'),
  validate(listUsersSchema),
  userController.listUsers
);
router.post(
  '/',
  authenticate,
  authorize('users:write'),
  verifyCsrfToken,
  validateBody(createUserSchema),
  userController.createUser
);
router.get('/:id', authenticate, authorize('users:read'), userController.getUser);
router.get('/:id/audit-logs', authenticate, authorize('users:read'), userController.getUserAuditLogs);
router.get(
  '/:id/related-sales',
  authenticate,
  authorize('users:read', 'example-sales:read'),
  userController.getUserRelatedSales
);
router.patch(
  '/:id',
  authenticate,
  authorize('users:write'),
  verifyCsrfToken,
  validateBody(adminUpdateUserSchema),
  userController.updateUser
);
router.delete(
  '/:id',
  authenticate,
  authorize('users:delete'),
  verifyCsrfToken,
  userController.deleteUser
);

export default router;
