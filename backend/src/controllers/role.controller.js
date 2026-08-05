import { roleRepository } from '#services/roleRepository.js';
import { asyncHandler } from '#utils/asyncHandler.js';

/** Powers the admin Users module's role filter/assignment dropdowns. */
export const listRoles = asyncHandler(async (req, res) => {
  const roles = await roleRepository.listAll();
  res.json({ roles });
});
