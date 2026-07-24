import { db } from '#db/knex.js';
import { userRepository } from '#services/userRepository.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userRepository.update(req.user.id, req.body);
  res.json({ user });
});

/** Admin-only: list users. Demonstrates the `authorize('admin')` RBAC pattern. */
export const listUsers = asyncHandler(async (req, res) => {
  const users = await db('users').select(
    'id',
    'name',
    'email',
    'role',
    'auth_provider',
    'created_at'
  );
  res.json({ users });
});
