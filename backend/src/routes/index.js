import { Router } from 'express';
import authRoutes from '#routes/auth.routes.js';
import userRoutes from '#routes/user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
