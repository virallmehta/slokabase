import { Router } from 'express';
import * as roleController from '#controllers/role.controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
} from '#validators/role.validators.js';

// Lightweight dropdown list — mounted at /api/v1/roles (see app.js), gated
// on users:read (any caller who can see the Users module), not roles:manage.
export const roleRouter = Router();
roleRouter.get('/', authenticate, authorize('users:read'), roleController.listRoles);

// Full Roles & Permissions management — mounted at /api/v1/admin/roles.
export const roleAdminRouter = Router();

roleAdminRouter.get('/', authenticate, authorize('roles:manage'), roleController.listRolesAdmin);
roleAdminRouter.post(
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
roleAdminRouter.get(
  '/permissions/catalog',
  authenticate,
  authorize('roles:manage'),
  roleController.getPermissionCatalog
);
roleAdminRouter.get(
  '/:id/permissions',
  authenticate,
  authorize('roles:manage'),
  roleController.getRolePermissions
);
roleAdminRouter.put(
  '/:id/permissions',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  validateBody(updateRolePermissionsSchema),
  roleController.updateRolePermissions
);
roleAdminRouter.patch(
  '/:id',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  validateBody(updateRoleSchema),
  roleController.updateRole
);
roleAdminRouter.delete(
  '/:id',
  authenticate,
  authorize('roles:manage'),
  verifyCsrfToken,
  roleController.deleteRole
);
