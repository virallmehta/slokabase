import { Router } from 'express';
import * as settingsController from '#controllers/settings.controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import { updateSettingSchema } from '#validators/settings.validators.js';

const router = Router();

router.get('/', authenticate, authorize('settings:manage'), settingsController.listSettings);
router.put(
  '/:key',
  authenticate,
  authorize('settings:manage'),
  verifyCsrfToken,
  validateBody(updateSettingSchema),
  settingsController.updateSetting
);

export default router;
