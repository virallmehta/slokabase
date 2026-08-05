import { Router } from 'express';
import * as authController from '#controllers/auth.controller.js';
import { validateBody } from '#middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '#validators/auth.validators.js';
import { authenticate } from '#middleware/authenticate.js';
import { verifyCsrfToken } from '#middleware/csrf.js';
import { authRateLimiter } from '#middleware/rateLimiters.js';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), authController.register);
router.post('/login', authRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, authController.refresh);
router.post('/logout', verifyCsrfToken, authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

export default router;
