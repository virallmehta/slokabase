import { Router } from 'express';
import * as saleController from './controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import { createSaleSchema, updateSaleSchema } from './validators.js';

const router = Router();

router.get('/', authenticate, authorize('sales:read'), saleController.listSales);
router.get('/:id', authenticate, authorize('sales:read'), saleController.getSale);
router.post(
  '/',
  authenticate,
  authorize('sales:write'),
  verifyCsrfToken,
  validateBody(createSaleSchema),
  saleController.createSale
);
router.patch(
  '/:id',
  authenticate,
  authorize('sales:write'),
  verifyCsrfToken,
  validateBody(updateSaleSchema),
  saleController.updateSale
);
router.delete(
  '/:id',
  authenticate,
  authorize('sales:delete'),
  verifyCsrfToken,
  saleController.deleteSale
);

export default router;
