import { db } from '#db/knex.js';

const PUBLIC_COLUMNS = ['id', 'name', 'email', 'role', 'auth_provider', 'created_at'];

export const userRepository = {
  findByEmail: (email) => db('users').where({ email }).first(),

  findById: (id) => db('users').select(PUBLIC_COLUMNS).where({ id }).first(),

  findByExternalId: (authProvider, externalId) =>
    db('users').where({ auth_provider: authProvider, external_id: externalId }).first(),

  create: async ({
    name,
    email,
    passwordHash = null,
    role = 'user',
    authProvider = 'local',
    externalId = null,
  }) => {
    const [id] = await db('users').insert({
      name,
      email,
      password_hash: passwordHash,
      role,
      auth_provider: authProvider,
      external_id: externalId,
    });
    return userRepository.findById(id);
  },

  update: async (id, fields) => {
    await db('users')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now() });
    return userRepository.findById(id);
  },
};
