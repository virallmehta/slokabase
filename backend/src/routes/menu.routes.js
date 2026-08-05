import { Router } from 'express';
import * as menuController from '#controllers/menu.controller.js';
import { authenticate } from '#middleware/authenticate.js';

const router = Router();

// No specific authorize() permission here — the menu itself is the filter,
// each node is only included if the caller holds its requiredPermission.
router.get('/', authenticate, menuController.getMenu);

export default router;
