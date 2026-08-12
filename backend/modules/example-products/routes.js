import { Router } from 'express';
import * as productController from './controller.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { validateBody } from '#middleware/validate.js';
import { createProductSchema, updateProductSchema } from './validators.js';

const router = Router();

router.get('/', authenticate, authorize('example-products:read'), productController.listProducts);
router.get('/:id', authenticate, authorize('example-products:read'), productController.getProduct);
router.post(
  '/',
  authenticate,
  authorize('example-products:write'),
  verifyCsrfToken,
  validateBody(createProductSchema),
  productController.createProduct
);
router.patch(
  '/:id',
  authenticate,
  authorize('example-products:write'),
  verifyCsrfToken,
  validateBody(updateProductSchema),
  productController.updateProduct
);
router.delete(
  '/:id',
  authenticate,
  authorize('example-products:delete'),
  verifyCsrfToken,
  productController.deleteProduct
);

export default router;
