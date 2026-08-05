import { ApiError } from '#utils/ApiError.js';
import { hashPassword, verifyPassword } from '#utils/password.js';
import { userRepository } from '#services/userRepository.js';

/**
 * Default provider — users live in this app's own `users` table,
 * passwords hashed with bcrypt. Use this unless you specifically need to
 * defer identity to an existing WordPress or Wagtail install.
 */
export const localProvider = {
  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({ name, email, passwordHash, roleKey: 'member' });
    return { user };
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw ApiError.unauthorized('Invalid email or password');

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) throw ApiError.unauthorized('Invalid email or password');

    return { user };
  },
};
