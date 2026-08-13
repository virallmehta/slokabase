# Slokabase

**A production-ready React + Express admin application starter** — authentication, role-based access control, a plug-in module system, automatic audit logging, and a polished admin UI, all wired together and ready to build on.

Slokabase isn't a UI kit or a todo-app tutorial. It's the boring, easy-to-get-wrong backbone every internal tool and admin panel needs — sessions, permissions, password recovery, an audit trail, a way to add new domain areas without touching core files — already built, tested, and documented, so you start your actual project on day one instead of week three.

## Who this is for

- **Developers and agencies** who build admin-heavy business applications (internal tools, back-office panels, B2B SaaS admin surfaces) and are tired of rebuilding auth/RBAC/audit-logging from scratch on every engagement.
- **Teams starting a new internal product** who want a real architectural foundation — not a scaffold you'll rip out in a month — with conventions strict enough that a new contributor can be productive on day one.
- Anyone who wants **cookie-based auth done correctly** (httpOnly, CSRF double-submit, refresh rotation, reuse detection) without assembling it themselves from blog posts.

## Key features

**Authentication & sessions**
- httpOnly access + refresh token cookies — never in `localStorage`, never readable by JavaScript
- CSRF double-submit protection on every mutating request
- Refresh token rotation with reuse detection (a replayed, already-rotated token revokes the entire session family)
- Pluggable auth providers — local (bcrypt + JWT) out of the box, with WordPress and Wagtail/Django adapters included as a pattern for wiring up your own
- Forgot/reset password flow with single-use, expiring, hashed tokens — and a generic response that never reveals whether an email is registered
- Admin-created users get a system-generated password, emailed to them, with a forced password-change gate on first login

**Authorization**
- Permission-based RBAC (`users:read`, `example-products:write`, ...) — not just role names — checked fresh from the database on every request, so a permission change takes effect immediately, not on next login
- Three starter roles (admin/manager/member); permissions compose per role via a join table, not hardcoded `if (role === 'admin')` checks scattered through the codebase

**Extensibility**
- **Module registry pattern**: a new domain area (Products, Sales, your own) is a self-contained folder — routes, controller, repository, validators, migrations, permissions, and a sidebar menu entry — that auto-registers itself. No editing `app.js`, no touching core route files.
- Each module's migrations run in an isolated tracking table, so adding or removing one never disturbs another's history

**Audit logging, automatically**
- Every module's create/update/delete mutations are logged for free — a module builds its repository on a shared `createAuditedRepository` wrapper and gets a full before/after audit trail with zero logging code of its own
- A searchable, filterable Audit Log admin page ships out of the box, unifying every module's activity into one view

**Admin UI**
- React 19 + TypeScript, Tailwind v4 + shadcn/ui, fully typed end to end
- Established, reusable list-view and detail-view patterns (search, filters, bulk actions, pagination, kebab menus) so a new admin page takes hours, not days
- A real design system, not ad-hoc styling — documented tokens, contrast requirements, and interaction patterns a designer or new engineer can actually check work against

**Email**
- Provider-agnostic email service — every call goes through one function, so swapping from local dev (Mailpit) to a real provider (Resend, Brevo, SES, ...) is an environment variable change, not a code change

## Tech stack

| | Backend | Frontend |
|---|---|---|
| Core | Node.js, Express | React 19, TypeScript, Vite |
| Data | Knex (SQLite for dev/test, MySQL/PostgreSQL for production) | — |
| Auth | bcrypt, JSON Web Tokens, httpOnly cookies | Zustand (session mirror, not source of truth) |
| Validation | Zod | Zod + React Hook Form |
| Styling | — | Tailwind CSS v4, shadcn/ui (Radix primitives) |
| Data fetching | — | Axios, `@tanstack/react-table` |
| Email | Nodemailer | — |
| Testing | Vitest, Supertest | Vitest |

## Project structure

```
.
├── backend/                 Express API (Knex, RBAC, module registry)
│   ├── src/
│   │   ├── controllers/     Core controllers (auth, users, roles, settings, auditLog)
│   │   ├── services/        Repositories & business logic (users, roles, settings)
│   │   ├── middleware/      authenticate, authorize, CSRF, rate limiting
│   │   ├── db/               Core migrations & seeds
│   │   └── routes/           Core routes (auth, users, roles, settings, audit log)
│   └── modules/              Self-contained, optional feature modules
│       ├── example-products/ Example module (backend-only reference)
│       └── example-sales/    Example module (backend-only reference)
│
├── frontend/                 React admin app
│   └── src/
│       ├── pages/             auth/ (Login, Register, Forgot/Reset Password) and admin/ (Users, Roles, Settings, Audit Log)
│       ├── layouts/           Dashboard shell, sidebar, topbar
│       ├── services/          One file per API domain — the only layer that talks to the backend
│       ├── store/             Zustand stores (auth, theme)
│       └── components/ui/     shadcn/ui component library
│
├── backend/CLAUDE.md          Backend architecture & conventions
├── frontend/CLAUDE.md         Frontend architecture & conventions
└── frontend/DESIGN.md         Visual/interaction design system — source of truth for UI work
```

## Getting started

### Prerequisites

- Node.js 20+
- (Optional, for testing email locally) [Mailpit](https://mailpit.axllent.org/) — `docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`, or your platform's package manager

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set at least:

```bash
JWT_ACCESS_SECRET=<a long random string>       # e.g. `openssl rand -hex 64`
JWT_REFRESH_SECRET=<a different long random string>
```

Everything else has a sensible local-dev default — SQLite with no setup, Mailpit for email at `localhost:1025`. To point at a real database, set `DB_CLIENT` to `mysql2` or `pg` and fill in `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`. To send real email, replace the `EMAIL_*` block with your provider's SMTP credentials — nothing in the codebase needs to change:

```bash
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-username
EMAIL_PASSWORD=your-smtp-password
EMAIL_FROM="Your App <no-reply@yourdomain.com>"
```

Then set up the database and start the server:

```bash
npm run migrate     # core schema + every module's own migrations
npm run seed         # starter roles/permissions, a default admin user, example settings
npm run dev           # http://localhost:3000, restarts on change
```

The seed prints a default admin login to the console (`admin@example.com` / `ChangeMe123!` unless `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are set) — **change or remove this before any shared or production use.**

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # only needed if the backend isn't at the default URL below
npm run dev              # http://localhost:5173
```

The frontend expects the backend at `http://localhost:3000/api/v1` by default (`VITE_API_URL`) — edit `.env` to point elsewhere.

### 3. Log in

Visit `http://localhost:5173`, sign in with the seeded admin credentials, and you're in — Dashboard, Users, Roles, Audit Log, and Settings are all live against real data from the first run.

## Adding your own module

A new domain area (e.g. "Invoices") is a folder under `backend/modules/invoices/` with a manifest, routes, a controller, a repository built on the shared audit-logging wrapper, validators, and its own migrations — nothing to register by hand. `backend/.claude/skills/module-registry-pattern/SKILL.md` is the full checklist; `backend/modules/example-products/` and `backend/modules/example-sales/` are working examples to copy. Add a corresponding frontend list/detail page pair following `frontend/.claude/skills/admin-crud-pattern/SKILL.md` and `frontend/DESIGN.md`, and it's a fully integrated part of the admin — sidebar entry, permissions, and audit trail included.

## Testing

```bash
cd backend && npm test     # Vitest + Supertest — full API integration coverage
cd frontend && npm test    # Vitest — logic-level coverage (stores, services, validators)
```

## License

This repository doesn't ship a license file. Add one appropriate for your use (MIT is a common choice for a boilerplate) before distributing or open-sourcing it.
