import { Router } from 'express';
import * as settingsController from '#controllers/settings.controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import { updateSettingSchema } from '#validators/settings.validators.js';

// Full admin CRUD — mounted at /api/v1/admin/settings.
export const settingsRouter = Router();
settingsRouter.get('/', authenticate, authorize('settings:read'), settingsController.listSettings);
settingsRouter.put(
  '/:key',
  authenticate,
  authorize('settings:manage'),
  verifyCsrfToken,
  validateBody(updateSettingSchema),
  settingsController.updateSetting
);
// Same gate as PUT — sends a real email using the currently-configured
// SMTP settings, which is a "does this actually work" check on the same
// privilege level as changing the settings themselves.
settingsRouter.post(
  '/test-email',
  authenticate,
  authorize('settings:manage'),
  verifyCsrfToken,
  settingsController.sendTestEmail
);

// Public (any authenticated user) — mounted at /api/v1/settings/public.
// No authorize() call at all: this is deliberately reachable by every
// logged-in user, not gated on settings:read/settings:manage.
export const publicSettingsRouter = Router();
publicSettingsRouter.get('/', authenticate, settingsController.getPublicSettings);
