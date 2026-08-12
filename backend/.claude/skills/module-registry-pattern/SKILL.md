---
name: module-registry-pattern
description: Use when adding a new self-contained, *optional* backend feature module (e.g. a new domain area like Leads or Companies) to Slokabase's backend, so it auto-registers routes, permissions, and menu entries without editing app.js or src/db. Not for core infrastructure (Users, Roles, Settings, Audit Log) — those live in backend/src/ directly.
---

# Module registry pattern

`modules/` is exclusively for **optional domain features** — Users, Roles, Settings, and Audit Log are mandatory core infrastructure and live under `backend/src/` instead (see `backend/CLAUDE.md`); this pattern is not for them. Optional feature modules live under `backend/modules/<name>/` as fully self-contained plug-ins. `modules/index.js` discovers any subdirectory containing a `config.js` and wires it in automatically — no changes to `app.js` or `src/db` are needed to add or remove one. **Example Products** (`backend/modules/example-products/`) and **Example Sales** (`backend/modules/example-sales/`) are reference implementations demonstrating the pattern — including how one module (`example-sales`) can depend on another (`example-products`) via a plain relative import; copy their shape for a new module, or delete them outright if your project doesn't need a Products/Sales domain.

## Checklist for a new module

1. Create `backend/modules/<name>/` with:
   - `config.js` — the manifest (see shape below)
   - `routes.js` — Express router, default export
   - `controller.js` — request handlers
   - `repository.js` — Knex queries, following `userRepository.js`'s pattern (see below), not `lead.controller.js`'s older direct-`db()`-in-controller pattern. Mutations (create/update/delete) **must** go through `createAuditedRepository` (see "Audit logging is automatic" below) — not raw `db(table).insert/update/del`.
   - `validators.js` — Zod schemas
   - `migrations/` — this module's own migration files (run against an isolated `knex_migrations_<key>` tracking table via `modules/migrate.js`, separate from core `src/db` migrations)
2. Add the module's permission keys to its `config.js` `permissions` array and grant them to core roles via `rolePermissions` — this flows into the seed automatically (see below), but if `db/seeds/00_roles_permissions.js` has already been run in dev, re-run `npm run seed` to pick up the new permissions.
3. Protect routes with `authenticate` + `authorize('<name>:read'|'write'|'delete')` + `verifyCsrfToken` on mutating routes, matching `example-products/routes.js`.
4. Confirm no changes to `app.js` are needed — the registry loop there (`for (const mod of modules) ...`) mounts any module found by `modules/index.js` automatically.

## `config.js` manifest shape

```js
export default {
  key: 'example-products',                    // used for basePath fallback, migration table name, permission prefix
  basePath: '/api/v1/example-products',       // mount path in app.js's registry loop

  permissions: [
    { key: 'example-products:read', description: 'View products' },
    { key: 'example-products:write', description: 'Create/edit products' },
    { key: 'example-products:delete', description: 'Delete products' },
  ],

  // Which of the *existing* core roles (admin/manager/member) get which
  // permissions. Modules only grant onto the existing role set — they
  // never define new roles.
  rolePermissions: {
    admin: ['example-products:read', 'example-products:write', 'example-products:delete'],
    manager: ['example-products:read', 'example-products:write'],
    member: [],
  },

  menu: {
    label: 'Example Products',
    icon: 'box',
    order: 10,
    group: 'Catalog',
    requiredPermission: 'example-products:read',
    children: [],
  },
};
```

`routes.js` is imported and attached to this object by `modules/index.js` (`{ ...config, routes }`) — don't put `routes` in `config.js` itself.

## Routes → controllers → services

Follow `user.routes.js`'s pattern, not `lead.controller.js`'s:

- **routes.js**: wire `authenticate`, `authorize('<perm>')`, `verifyCsrfToken` (mutating routes only), and `validateBody(schema)` per route — see `example-products/routes.js`.
- **controller.js**: thin — call the repository, translate results/errors to HTTP responses (`ApiError.notFound`, etc.), wrap handlers in `asyncHandler`. No Knex calls here.
- **repository.js**: all Knex query logic lives here, exported as a plain object of functions (`findAll`, `findById`, `create`, `update`, `remove`, ...), mirroring `userRepository.js`. Do **not** query `db('<table>')` directly from the controller — that's the older pattern still present in `lead.controller.js` and is not what new modules should follow.

## Audit logging is automatic — use `createAuditedRepository`

Every module's `create`/`update`/`remove` **must** be built on `createAuditedRepository` (`backend/src/services/auditedRepository.js`) instead of raw `db(table).insert/update/del`. It writes the `audit_logs` entry itself, so a module never calls `auditLogRepository` directly for a create/update/delete — audit logging is a side effect of using the wrapper, not something you write.

```js
import { createAuditedRepository } from '#services/auditedRepository.js';

const audited = createAuditedRepository('example_products', 'example-products'); // (tableName, moduleName)

export const productRepository = {
  findById: (id) => db('example_products').where({ id }).first(),

  create: async (data, { actorId, changes } = {}) => {
    const id = await audited.insert(data, { actorId, changes });
    return productRepository.findById(id);
  },

  update: async (id, fields, { actorId, changes } = {}) => {
    await audited.update(id, fields, { actorId, changes });
    return productRepository.findById(id);
  },

  remove: (id, { actorId, changes } = {}) => audited.del(id, { actorId, changes }),
};
```

Notes:

- `insert`/`del` always record an entry (`create`/`delete` are unconditional events). `update` only records when `changes` is a non-empty object — pass `undefined`/`{}` for a no-op update you don't want logged.
- The module still owns its own diffing (which fields are auditable, redacting secrets like passwords) — compute `changes` in the controller (or repository) and hand it to `audited.insert/update/del`; the wrapper just persists whatever it's given, it doesn't inspect columns itself.
- If a table's primary key isn't `id` (e.g. Settings' `app_settings.key`), pass `{ idColumn: 'key' }` as `createAuditedRepository`'s third argument.
- Controllers pass `req.user.id` as `actorId` — see core `src/services/roleRepository.js` and `src/services/settingsRepository.js` for worked examples (Users' equivalent lives in `src/services/userRepository.js`).
- An action that isn't a create/update/delete on this table (e.g. Roles' `update_permissions`, which mutates the join table `role_permissions`, or Users' `password_change`) is outside the wrapper's scope — call `auditLogRepository.record(...)` directly for those, as `src/controllers/role.controller.js` and `user.controller.js` do.

## Permission seeding

`db/seeds/00_roles_permissions.js` imports `modules` from `#modules/index.js` and merges each module's `permissions` and `rolePermissions` into the base RBAC set at seed time — it loops the registry, so **you don't hand-edit this seed file** when adding a module; just populate `permissions`/`rolePermissions` in the module's own `config.js` and re-run `npm run seed`.

## Migrations

Put this module's migrations in `backend/modules/<name>/migrations/`. `modules/migrate.js` runs them against the same database but an isolated `knex_migrations_<key>` tracking table, so adding/removing/rolling back one module never touches core `src/db` migration history or another module's. This is wired into the existing `npm run migrate` / `migrate:rollback` / `seed` commands — no separate command to remember.

## Confirm: no `app.js` changes needed

`app.js` already loops the module registry (`for (const mod of modules) { app.use(mod.basePath, mod.routes); ... }`) and `menu.controller.js` already loops it to build the menu tree. Adding a well-formed `config.js` + `routes.js` is sufficient — if you find yourself editing `app.js` to add a module, something's wrong with the module's `config.js`.
