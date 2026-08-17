# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/). See [CONTRIBUTING.md](CONTRIBUTING.md) for how entries move from `[Unreleased]` to a version heading.

## [Unreleased]

## [1.0.0] - 2026-08-17

Initial release.

### Added

- **RBAC (permission-based, not role-based)**: `roles` → `role_permissions` → `permissions`, with `authorize(...)` requiring all listed permission keys and loading them fresh from the DB on every request (no caching in the JWT, so role/permission changes apply immediately). `roles:*` and `settings:*` are split into `:read`/`:manage` tiers so a role can view an admin section without being able to change it.
- **Audit logging**, automatic rather than opt-in: `createAuditedRepository` wraps a table's create/update/delete so every module gets an `audit_logs` entry for free, including field-level diffs (with sensitive fields redacted) and dedicated handling for no-diff actions like password changes/resets.
- **Module registry pattern**: a self-contained-module system (`modules/example-products/`, `modules/example-sales/` as reference implementations) for adding optional domain features with auto-registered routes, permissions, and menu entries, and an isolated per-module migration history — without touching `app.js` or the core `src/db` migration chain.
- **Settings system**: soft settings (`app_settings` table, `settingsRepository`) for values an admin should be able to change at runtime without a redeploy — `app_name` branding and SMTP config layered over the `EMAIL_*` env vars — distinct from hard config (env vars) and plain constants.
- **Last-admin guard**: prevents removing admin permissions/deleting the last admin account, so a deployment can't lock itself out of its own admin area.
- **Toast notifications** across the frontend admin app for action feedback (create/update/delete/errors).
- **Demo account and role**: a seeded read-only `demo` account intended for public-facing deployments, holding only `:read` permissions across Users/Roles/Settings/Audit Log/example modules.
- **Vercel + Neon deployment support**: `vercel.json` for both apps and Postgres (Neon) as a supported Knex driver alongside SQLite (dev/test) and MySQL.

### Fixed

- **`auditedRepository.js` cross-database bug**: `insert()` destructured `.insert()`'s return value assuming SQLite's shape (`[id]`), which crashed every single insert on Postgres (`... is not iterable`) — invisible to the SQLite-backed test suite. Fixed by forcing `.returning()` via the id column across drivers and unwrapping the id only when the result is an object; covered going forward by a Postgres-specific regression test (`src/tests/auditedRepository.pg.test.js`, run with `DB_CLIENT=pg`) rather than relying on the SQLite suite to catch driver-specific behavior.
