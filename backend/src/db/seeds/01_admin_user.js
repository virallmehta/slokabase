import bcrypt from 'bcryptjs';

/**
 * Creates a default admin account for local development.
 * CHANGE THIS PASSWORD (or delete this seed) before any shared/staging use.
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const existing = await knex('users').where({ email }).first();
  if (existing) return;

  const adminRole = await knex('roles').where({ key: 'admin' }).first();
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!', 12);

  await knex('users').insert({
    name: 'Admin',
    email,
    password_hash: passwordHash,
    role_id: adminRole.id,
    auth_provider: 'local',
  });

  console.log(
    `Seeded admin user: ${email} (password: ${process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'})`
  );
}
