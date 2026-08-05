# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Repository layout

Monorepo with two independently-run apps, no root package.json or workspace tooling — always `cd` into `backend/` or `frontend/` before running npm commands.

- `backend/` — Node/Express + Knex API (the active, git-tracked project). See [backend/CLAUDE.md](backend/CLAUDE.md) for conventions.
- `frontend/` — React + Vite + TypeScript + shadcn/ui admin app. See [frontend/CLAUDE.md](frontend/CLAUDE.md) for conventions.
- `workflows/` — currently empty.
- `docs/` — three reference boilerplate repos (`demo-leadflow`, `express-backend`, `react-boilerplate-part-1`), each its own git repo, gitignored from this one. They're the upstream templates `backend/` and `frontend/` were generated from — useful for comparing "intended" patterns against what's implemented here, not code to run or edit.

For detailed architecture, commands, and conventions for each app, see its own `CLAUDE.md`.
