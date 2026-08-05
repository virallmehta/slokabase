import { Router } from 'express';
import * as roleController from './controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
} from './validators.js';

const router = Router();

router.get('/', authenticate, authorize('roles:manage'), roleController.listRoles);
router.post(
  '/',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  validateBody(createRoleSchema),
  roleController.createRole
);
// Registered before /:id/permissions — not strictly required (the two
// routes' second segment never collides: "catalog" vs "permissions"), but
// keeps the more specific static route visually next to its sibling.
router.get(
  '/permissions/catalog',
  authenticate,
  authorize('roles:manage'),
  roleController.getPermissionCatalog
);
router.get(
  '/:id/permissions',
  authenticate,
  authorize('roles:manage'),
  roleController.getRolePermissions
);
router.put(
  '/:id/permissions',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  validateBody(updateRolePermissionsSchema),
  roleController.updateRolePermissions
);
router.patch(
  '/:id',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  validateBody(updateRoleSchema),
  roleController.updateRole
);
router.delete(
  '/:id',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  roleController.deleteRole
);

export default router;
