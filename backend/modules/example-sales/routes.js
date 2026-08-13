import { Router } from 'express';
import * as saleController from './controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import { createSaleSchema, updateSaleSchema } from './validators.js';

const router = Router();

router.get('/', authenticate, authorize('example-sales:read'), saleController.listSales);
router.get('/:id', authenticate, authorize('example-sales:read'), saleController.getSale);
router.post(
  '/',
  authenticate,
  authorize('example-sales:write'),
  verifyCsrfToken,
  validateBody(createSaleSchema),
  saleController.createSale
);
router.patch(
  '/:id',
  authenticate,
  authorize('example-sales:write'),
  verifyCsrfToken,
  validateBody(updateSaleSchema),
  saleController.updateSale
);
router.delete(
  '/:id',
  authenticate,
  authorize('example-sales:delete'),
  verifyCsrfToken,
  saleController.deleteSale
);

export default router;
