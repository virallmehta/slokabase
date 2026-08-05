import { Router } from 'express';
import * as roleController from '#controllers/role.controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';

const router = Router();

router.get('/', authenticate, authorize('users:read'), roleController.listRoles);

export default router;
