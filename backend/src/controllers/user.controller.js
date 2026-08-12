import crypto from 'node:crypto';
import { userRepository } from '#services/userRepository.js';
import { auditLogRepository } from '#services/auditLogRepository.js';
import { sendEmail } from '#services/emailService.js';
import { hashPassword, verifyPassword } from '#utils/password.js';
import { toPublicUser } from '#utils/publicUser.js';
import { asyncHandler } from '#utils/asyncHandler.js';
import { ApiError } from '#utils/ApiError.js';

// Only fields that make sense as a readable "from -> to" audit entry.
// Password changes are logged as an action with no diff (see
// changePassword) — never log secret values.
const AUDITABLE_FIELDS = ['name', 'email', 'status'];

function diffUserFields(existing, updates) {
  const changes = {};
  for (const field of AUDITABLE_FIELDS) {
    if (updates[field] !== undefined && updates[field] !== existing[field]) {
      changes[field] = { from: existing[field], to: updates[field] };
    }
  }
  if (updates.roleKey !== undefined && updates.roleKey !== existing.role) {
    changes.role = { from: existing.role, to: updates.roleKey };
  }
  return changes;
}

export const getProfile = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: await toPublicUser(user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const existing = await userRepository.findById(req.user.id);
  if (!existing) throw ApiError.notFound('User not found');

  const changes = diffUserFields(existing, req.body);
  const user = await userRepository.update(req.user.id, req.body, { actorId: req.user.id, changes });
  res.json({ user: await toPublicUser(user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await userRepository.findByIdWithSecrets(req.user.id);
  if (!user) throw ApiError.notFound('User not found');

  if (user.auth_provider !== 'local' || !user.password_hash) {
    throw ApiError.badRequest('Password changes are not supported for this account');
  }

  const valid = await verifyPassword(req.body.currentPassword, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');

  const password_hash = await hashPassword(req.body.newPassword);
  // Clearing must_change_password here (not just on the forced first-login
  // path) means this endpoint always leaves the account in a "no forced
  // change pending" state, however the user got here.
  await userRepository.update(user.id, { password_hash, must_change_password: false });
  // Action-only entry — never log the password itself, old or new.
  await auditLogRepository.record({
    entityType: 'user',
    entityId: user.id,
    action: 'password_change',
    actorId: req.user.id,
  });
  res.json({ success: true });
});

/**
 * Admin-only: paginated/searchable/filterable user list. Note this does
 * NOT include each row's `permissions` (unlike toPublicUser) — that would
 * be a wasted per-row DB query nobody asked for; the admin Users module
 * only needs role/status, not a full permission breakdown per user.
 */
export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, status, page, limit } = req.query;
  const result = await userRepository.list({ search, role, status, page, limit });
  res.json(result);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user });
});

/**
 * Admin-only: create a user directly (as opposed to self-service
 * /auth/register). Generates a system-random temporary password, emails it
 * directly to the new user (never returned in the API response — that
 * would be a second exposure channel for a secret meant to be single-use),
 * and forces a change on first login via must_change_password (see
 * enforcePasswordChange middleware). Role assignment (beyond the 'member'
 * default) requires roles:manage, same gate as updateUser.
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, roleKey } = req.body;

  if (roleKey && !req.user.permissions.includes('roles:manage')) {
    throw ApiError.forbidden('Only users with roles:manage can assign a role');
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await userRepository.create(
    { name, email, passwordHash, roleKey: roleKey || 'member', mustChangePassword: true },
    { actorId: req.user.id }
  );

  await sendEmail({
    to: user.email,
    subject: 'Your Slokabase account has been created',
    text: `Welcome to Slokabase! An account has been created for you.\n\nEmail: ${user.email}\nTemporary password: ${temporaryPassword}\n\nYou'll be asked to set your own password when you first log in.`,
    html: `<p>Welcome to Slokabase! An account has been created for you.</p><p><strong>Email:</strong> ${user.email}<br><strong>Temporary password:</strong> ${temporaryPassword}</p><p>You'll be asked to set your own password when you first log in.</p>`,
  });

  res.status(201).json({ user });
});

/**
 * Admin editing another user's record. Role reassignment is a strictly
 * more sensitive action than editing name/email/status — a manager with
 * only `users:write` could otherwise promote themselves (or anyone else)
 * to admin, so changing `roleKey` additionally requires `roles:manage`.
 * `req.user.permissions` is already populated by authorize() (see
 * middleware/authorize.js) by the time this controller runs.
 */
export const updateUser = asyncHandler(async (req, res) => {
  const existing = await userRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('User not found');

  const { roleKey } = req.body;
  if (roleKey && !req.user.permissions.includes('roles:manage')) {
    throw ApiError.forbidden('Only users with roles:manage can reassign roles');
  }

  const changes = diffUserFields(existing, req.body);
  const user = await userRepository.update(req.params.id, req.body, { actorId: req.user.id, changes });
  res.json({ user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const existing = await userRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('User not found');

  if (Number(req.params.id) === req.user.id) {
    throw ApiError.badRequest("You can't delete your own account");
  }

  await userRepository.remove(req.params.id, { actorId: req.user.id });
  res.status(204).send();
});

export const getUserAuditLogs = asyncHandler(async (req, res) => {
  const existing = await userRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('User not found');

  const logs = await auditLogRepository.listFor('user', req.params.id);
  res.json({ logs });
});

/**
 * "Related records" for the detail page's right rail — sales this user
 * has recorded (sales.created_by -> users.id, see modules/example-sales). Reaches
 * into a feature module from core, which is a deliberate, narrow
 * exception to the usual module boundary; tolerant of the module being
 * absent (returns an empty list) rather than crashing, so Users doesn't
 * hard-depend on Sales existing.
 */
export const getUserRelatedSales = asyncHandler(async (req, res) => {
  const existing = await userRepository.findById(req.params.id);
  if (!existing) throw ApiError.notFound('User not found');

  try {
    const { saleRepository } = await import('#modules/example-sales/repository.js');
    const sales = await saleRepository.findByCreatedBy(req.params.id);
    res.json({ sales });
  } catch {
    res.json({ sales: [] });
  }
});
