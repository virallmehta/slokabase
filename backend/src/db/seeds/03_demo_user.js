import bcrypt from 'bcryptjs';

/**
 * Public-demo-safe account — read-only across every admin section (see
 * the `demo` role's grants in db/seeds/00_roles_permissions.js). Intended
 * for the public Vercel deployment, where the login page can publish
 * these exact credentials for visitors to try the app without an invite.
 *
 * Deliberately does NOT set must_change_password: a public demo login
 * must work immediately with the published password, not force a reset
 * first. CHANGE OR REMOVE this seed before any deployment where a
 * publicly-known, unrevokable read-only login isn't intended.
 *
 * Opt-in, not opt-out: only runs when SEED_DEMO=true is explicitly set,
 * so a plain `npm run seed` against production/staging doesn't silently
 * create a publicly-known login. Set SEED_DEMO=true wherever you want the
 * demo account seeded (e.g. the public Vercel deployment's build step).
 *
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
  if (process.env.SEED_DEMO !== 'true') return;

  const email = process.env.SEED_DEMO_EMAIL || 'demo@example.com';
  const existing = await knex('users').where({ email }).first();
  if (existing) return;

  const demoRole = await knex('roles').where({ key: 'demo' }).first();
  const passwordHash = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD || 'DemoOnly123!', 12);

  await knex('users').insert({
    name: 'Demo',
    email,
    password_hash: passwordHash,
    role_id: demoRole.id,
    auth_provider: 'local',
  });

  console.log(
    `Seeded demo user: ${email} (password: ${process.env.SEED_DEMO_PASSWORD || 'DemoOnly123!'})`
  );
}
