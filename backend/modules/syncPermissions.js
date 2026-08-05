import { db } from '#db/knex.js';
import modules from './index.js';

/**
 * Idempotently ensures every module's declared permissions exist in the
 * `permissions` table — nothing more. Runs on every app startup (see
 * src/server.js) so a newly added module's permissions become queryable
 * (e.g. by the Roles & Permissions module) immediately, without anyone
 * needing to remember to run `npm run seed` after adding a module.
 *
 * Deliberately does NOT touch role_permissions grants — initial
 * role -> permission mappings for a fresh database are still handled,
 * once, by db/seeds/00_roles_permissions.js. This only keeps the
 * permissions table itself in sync with the module registry.
 */
export async function syncModulePermissions() {
  const declaredPermissions = modules.flatMap((mod) => mod.permissions || []);
  if (declaredPermissions.length === 0) return;

  const existingKeys = new Set(
    await db('permissions')
      .whereIn(
        'key',
        declaredPermissions.map((p) => p.key)
      )
      .pluck('key')
  );

  const missing = declaredPermissions.filter((permission) => !existingKeys.has(permission.key));
  if (missing.length > 0) {
    await db('permissions').insert(missing);
  }
}
