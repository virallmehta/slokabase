import { describe, it, expect } from 'vitest';
import modules from '#modules/index.js';

describe('Module registry (backend/modules/index.js)', () => {
  it('auto-discovers every self-contained module directory', () => {
    expect(modules.map((m) => m.key).sort()).toEqual([
      'audit-log',
      'products',
      'roles',
      'sales',
      'settings',
    ]);
  });

  it('each module exposes the required shape', () => {
    for (const mod of modules) {
      expect(typeof mod.key).toBe('string');
      expect(typeof mod.basePath).toBe('string');
      expect(mod.basePath.startsWith('/')).toBe(true);
      expect(typeof mod.routes).toBe('function'); // express.Router() is callable
      expect(Array.isArray(mod.permissions)).toBe(true);
      expect(mod.permissions.every((p) => typeof p.key === 'string')).toBe(true);
      expect(mod.rolePermissions).toMatchObject({
        admin: expect.any(Array),
        manager: expect.any(Array),
        member: expect.any(Array),
      });
      // Modules only grant permissions onto the existing core roles, they
      // never introduce new ones.
      expect(Object.keys(mod.rolePermissions).sort()).toEqual(['admin', 'manager', 'member']);
      expect(mod.menu).toMatchObject({
        label: expect.any(String),
        order: expect.any(Number),
        group: expect.any(String),
      });
    }
  });
});
