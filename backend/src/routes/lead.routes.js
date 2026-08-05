import { Router } from 'express';
import { getAllLeads, createLead } from '#controllers/lead.controller.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { validate } from '#middleware/validate.js';
import { createLeadSchema } from '#validators/lead.validators.js';

const router = Router();

// Routes mapped to controllers wrapped in our clean handler
router.get('/', asyncHandler(getAllLeads));
router.post('/', validate(createLeadSchema), asyncHandler(createLead));

export default router;
