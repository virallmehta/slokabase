import { describe, it, expect, afterAll } from 'vitest';
import { db } from '#db/knex.js';
import { syncModulePermissions } from '#modules/syncPermissions.js';
import { resetDatabase } from './testDb.js';

describe('syncModulePermissions (backend/modules/syncPermissions.js)', () => {
  afterAll(async () => {
    await db.destroy();
  });

  it('inserts a module permission missing from a fresh/older database, without granting it to any role', async () => {
    await resetDatabase();

    // Simulate an environment that hasn't re-seeded since a module added a
    // new permission: delete one that the seed already put there.
    await db('role_permissions')
      .whereIn('permission_id', db('permissions').select('id').where({ key: 'example-sales:delete' }))
      .del();
    await db('permissions').where({ key: 'example-sales:delete' }).del();

    let permission = await db('permissions').where({ key: 'example-sales:delete' }).first();
    expect(permission).toBeUndefined();

    await syncModulePermissions();

    permission = await db('permissions').where({ key: 'example-sales:delete' }).first();
    expect(permission).toBeTruthy();
    expect(permission.description).toBe('Delete sales');

    // Only the permissions table is touched — no role gets it back for free.
    const grants = await db('role_permissions').where({ permission_id: permission.id });
    expect(grants).toEqual([]);
  });

  it('is idempotent — running it again inserts nothing new', async () => {
    const before = await db('permissions').count({ count: '*' }).first();
    await syncModulePermissions();
    const after = await db('permissions').count({ count: '*' }).first();
    expect(Number(after.count)).toBe(Number(before.count));
  });

  it("leaves permissions the module registry doesn't declare untouched", async () => {
    const rolesManage = await db('permissions').where({ key: 'roles:manage' }).first();
    expect(rolesManage).toBeTruthy();
  });
});
