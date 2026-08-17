# Contributing

This document describes the git workflow standard for this repository. It applies to all work, including solo changes — there is no exception for "it's just me."

## Branch naming

Prefix every branch with the type of change it contains:

- `feature/` — new functionality
- `fix/` — bug fixes
- `docs/` — documentation only
- `refactor/` — internal restructuring with no behavior change
- `chore/` — tooling, deps, config, housekeeping

Example: `feature/module-registry`, `fix/last-admin-guard`.

## Commit messages

Format: `type: summary`, imperative mood.

```
feat: add public settings service and hook
fix: address final review findings
refactor: extract shared pagination constants
docs: document hard-config/soft-setting/plain-constant rule
chore: rename products/sales references to example-products/example-sales
```

- `type` matches the branch prefix vocabulary (`feat`, `fix`, `docs`, `refactor`, `chore`), plus `test:` for test-only changes.
- `summary` is imperative ("add x", not "added x" or "adds x") and describes what the commit does, not what problem prompted it.
- Keep the summary line short; put any needed detail in the commit body.

## Every branch gets a PR

Every branch merges into `main` via a pull request — even solo work with no other reviewer. This keeps a durable record of what changed and why, and keeps the merge step deliberate rather than accidental.

### PR description template

```
## Summary
What changed and why, in a sentence or two.

## Testing
How this was verified (commands run, manual checks performed).

## Database changes
Migrations added/modified, or "None".

## Breaking changes
Anything that breaks existing data, APIs, or workflows, or "None".
```

## Verify the merge actually landed

A PR existing, or even showing as "merged" in the UI, is not the same as the change being on `origin/main`. Before considering a merge done:

```
git fetch origin
git log origin/main --oneline -1
```

Confirm the commit is actually present on `origin/main`, not just that the PR was closed.

## Delete branches after merging

Once a branch is merged into `main`, delete it (both locally and on origin). Stale branches accumulate and make it unclear what's still in progress.

## Migrations: run immediately, never batch

Any merge to `main` that includes a schema-changing migration must be applied to the Neon database immediately after the merge lands — not batched up with other changes for later.

```
cd backend
npm run migrate
npm run seed
```

Always use `npm run migrate` / `npm run seed`, never bare `knex migrate:latest` or `knex seed:run` — the npm scripts also run the module-registry migration/seed step (`node modules/migrate.js migrate|seed`), which bare knex commands skip.

## Versioning and CHANGELOG

This project follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes
- **MINOR** — new functionality, backward compatible
- **PATCH** — bug fixes, backward compatible

`CHANGELOG.md` at the repo root tracks notable changes, following [Keep a Changelog](https://keepachangelog.com/) conventions:

- New entries go under `[Unreleased]` as they land.
- When a version is tagged, move the accumulated `[Unreleased]` entries under a new version heading (e.g. `[1.1.0] - 2026-08-17`) and leave `[Unreleased]` empty above it.
