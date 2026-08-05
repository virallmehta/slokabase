import { db } from '#db/knex.js';
import { roleRepository } from '#services/roleRepository.js';
import { createAuditedRepository } from '#services/auditedRepository.js';

const audited = createAuditedRepository('users', 'user');

const PUBLIC_COLUMNS = [
  'users.id',
  'users.name',
  'users.email',
  'users.role_id',
  'roles.key as role',
  'roles.name as role_name',
  'users.status',
  'users.auth_provider',
  'users.must_change_password',
  'users.last_login_at',
  'users.created_at',
];

export const userRepository = {
  findByEmail: (email) =>
    db('users').join('roles', 'roles.id', 'users.role_id').where('users.email', email).first(
      'users.*',
      'roles.key as role'
    ),

  findById: (id) =>
    db('users')
      .join('roles', 'roles.id', 'users.role_id')
      .select(PUBLIC_COLUMNS)
      .where('users.id', id)
      .first(),

  // Includes password_hash — only for internal use (verifying the current
  // password before a change), never returned in an API response.
  findByIdWithSecrets: (id) => db('users').where('users.id', id).first(),

  findByExternalId: (authProvider, externalId) =>
    db('users').where({ auth_provider: authProvider, external_id: externalId }).first(),

  /**
   * Paginated, searchable, filterable list for the admin Users module.
   * `search` matches name or email (substring, case-insensitive);
   * `role`/`status` filter exactly. Returns `{ users, total, page, limit }`
   * so the frontend can render pagination controls without a second
   * count query of its own.
   */
  list: async ({ search, role, status, page = 1, limit = 20 } = {}) => {
    const baseQuery = db('users').join('roles', 'roles.id', 'users.role_id');

    if (search) {
      baseQuery.where((builder) => {
        builder.whereILike('users.name', `%${search}%`).orWhereILike('users.email', `%${search}%`);
      });
    }
    if (role) baseQuery.where('roles.key', role);
    if (status) baseQuery.where('users.status', status);

    const countQuery = baseQuery.clone();
    const [{ count }] = await countQuery.count({ count: 'users.id' });

    const users = await baseQuery
      .clone()
      .select(PUBLIC_COLUMNS)
      .orderBy('users.name')
      .limit(limit)
      .offset((page - 1) * limit);

    return { users, total: Number(count), page, limit };
  },

  create: async (
    {
      name,
      email,
      passwordHash = null,
      roleKey = 'member',
      authProvider = 'local',
      externalId = null,
      mustChangePassword = false,
    },
    { actorId, changes } = {}
  ) => {
    const role = await roleRepository.findByKey(roleKey);
    if (!role) throw new Error(`Unknown role "${roleKey}"`);

    const id = await audited.insert(
      {
        name,
        email,
        password_hash: passwordHash,
        role_id: role.id,
        auth_provider: authProvider,
        external_id: externalId,
        must_change_password: mustChangePassword,
      },
      { actorId, changes }
    );
    return userRepository.findById(id);
  },

  // `roleKey` (if present) is resolved to `role_id` here rather than
  // requiring every caller to look it up — callers that allow reassigning
  // roles are responsible for their own permission check first (see
  // user.controller.js's updateUser, which requires roles:manage).
  update: async (id, fields, { actorId, changes } = {}) => {
    const { roleKey, ...rest } = fields;
    const updates = { ...rest };

    if (roleKey) {
      const role = await roleRepository.findByKey(roleKey);
      if (!role) throw new Error(`Unknown role "${roleKey}"`);
      updates.role_id = role.id;
    }

    await audited.update(id, updates, { actorId, changes });
    return userRepository.findById(id);
  },

  touchLastLogin: (id) => db('users').where({ id }).update({ last_login_at: db.fn.now() }),

  remove: (id, { actorId, changes } = {}) => audited.del(id, { actorId, changes }),
};
