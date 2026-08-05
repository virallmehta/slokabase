# CLAUDE.md (frontend)

This file provides guidance to Claude Code when working in `frontend/`.

React 19 + Vite + TypeScript admin app, Tailwind v4 + shadcn/ui (Radix primitives, `class-variance-authority`), React Router 7, Zustand, React Hook Form + Zod, Axios, `@tanstack/react-table`. Talks to `backend/` over httpOnly-cookie auth — this works correctly (see Auth below), not a known gap.

## Commands (run from `frontend/`)

```bash
npm run dev        # vite dev server
npm run build       # tsc -b && vite build
npm run preview
npm run lint         # oxlint
npm test             # vitest run
```

## Architecture

- Path alias: only `@/` → `./src` (`vite.config.ts`, `tsconfig*.json`). No other aliases — use `@/...` for all cross-folder imports, relative imports within the same folder.
- **Routing** (`src/routes/AppRoutes.tsx`): `GuestRoute` wraps `/login`, `/register`, `/forgot-password`, `/reset-password`; `ProtectedRoute` wraps `DashboardLayout` containing dashboard/profile/users/user-detail/roles/role-detail/audit-log/settings pages plus a catch-all `/:moduleKey` → `PlaceholderPage` for sidebar-linked modules that don't have a dedicated page yet. No public/marketing layout group exists. Route constants live in `src/constants/routes.ts` (`ROUTES` object).
- **State**: Zustand store at `src/store/authStore.ts` holds only `user` (id/name/email/role/permissions/`mustChangePassword`) + `status` — **no tokens, no `persist` middleware**. The session lives entirely in httpOnly cookies; the store re-hydrates by calling `GET /auth/me` on load. Don't add `persist` to this store or start storing tokens in it — that would reintroduce the bearer-token pattern this app deliberately avoids.
- **Auth / API client** (`src/services/api.ts`): axios instance with `withCredentials: true`. A request interceptor reads the non-httpOnly `csrf_token` cookie and sets it as the `X-CSRF-Token` header on mutating methods (POST/PUT/PATCH/DELETE) only; a response interceptor clears the auth store on 401. This mirrors the backend's httpOnly-cookie + CSRF double-submit design — keep new API calls going through this instance rather than a fresh axios client.
- **Forgot/reset password & forced password change**: `authService.forgotPassword`/`resetPassword` (`src/pages/auth/ForgotPassword.tsx`, `ResetPassword.tsx`) call the backend's always-generic-response forgot-password endpoint and its token-based reset endpoint — see `backend/CLAUDE.md`. Separately, `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`) is the single gate for the forced-password-change state: if `user.mustChangePassword` is true it renders `src/pages/ForcedPasswordChange.tsx` instead of `<Outlet/>`, so `DashboardLayout`/the sidebar never mounts and no other protected route is reachable — this mirrors the backend's `enforcePasswordChange` middleware being one global check rather than something threaded through every route. `ForcedPasswordChange` has no route path of its own and reuses `userService.changePassword` (the same endpoint `ProfilePage`'s self-service change uses); since that endpoint only returns `{ success: true }`, the page optimistically clears `mustChangePassword` in the store on success rather than round-tripping through `/auth/me` again.
- **Sidebar** (`src/layouts/AppSidebar.tsx` + `src/services/menuService.ts`): dynamic, not a static nav config — `menuService.getMenu()` calls `GET /menu` (unversioned on the backend, unlike every other `/api/v1/*` route; `env.apiRootUrl` in `src/config/env.ts` derives that root from `apiUrl`) and renders whatever `MenuGroup[]`/`MenuItem[]` tree comes back, with loading/error states. Backend modules registering a menu entry (see `backend/.claude/skills/module-registry-pattern/SKILL.md`) show up here automatically — no frontend nav changes needed for a new backend module's basic entry.
- **Pages** (`src/pages/`): `auth/` holds `Login`, `Register`, `ForgotPassword`, `ResetPassword` — all the same centered-`Card`, `GuestRoute`-wrapped shape. `admin/` holds `UsersListPage`/`UserDetailPage`, `RolesListPage`/`RoleDetailPage`, `AuditLogListPage`, `SettingsPage`, each following `frontend/.claude/skills/admin-crud-pattern/SKILL.md`'s list/detail shape — `AuditLogListPage` and `SettingsPage` are that skill's (and `DESIGN.md`'s) documented exceptions for read-only and single-form pages respectively, not unaudited gaps. `ForcedPasswordChange.tsx` lives at the top level of `src/pages/` (not under `auth/` or `admin/`) since it's rendered directly by `ProtectedRoute`, not routed to.
- **New page**: add the component under `src/pages/<area>/` (existing subfolders: `auth/`, `admin/`), register its route + path constant in `src/constants/routes.ts`, then wire it into `AppRoutes.tsx`.
- **New API call**: add it to the relevant file in `src/services/` (one file per domain, e.g. `authService.ts`, `menuService.ts`, `userService.ts`) — don't call `api`/axios directly from components.
- **New list/detail admin view**: follow `frontend/.claude/skills/admin-crud-pattern/SKILL.md` for the established table/filter/detail-page pattern rather than building one from scratch.
- **Forms**: Zod schemas wired with `useForm({ resolver: zodResolver(schema) })` — React Hook Form + Zod throughout.
- **Env vars**: read via `env` in `src/config/env.ts` (`VITE_API_URL`, defaulting to `http://localhost:3000/api/v1`) rather than reading `import.meta.env` directly elsewhere.

## Design tokens (`src/index.css`)

- Borders are 0.5px (enforced via a `@layer utilities` override), not the Tailwind default 1px.
- Border radius is small and flat: `--radius: 0.3125rem` (5px) base, driving the whole radius scale.
- Badges (`src/components/ui/badge.tsx`) are flat, plain-colored variants (`success`/`warning`/`danger` — emerald-600/amber-600/red-600), not tinted/dot-style.
- Accent color is blue (`--primary`, oklch-defined).
- Font is Inter, self-hosted via `@fontsource/inter` (`@import "@fontsource/inter/{400,500,600,700}.css"` in `src/index.css`) — not a Google Fonts CDN link.

## Testing

Vitest (`vitest.config.ts`: `globals: true`, `environment: jsdom`, `@` alias) — logic-level unit tests only (stores, services), no component/UI testing library installed. Tests live in `src/tests/*.test.ts` (e.g. `authStore.test.ts`, `api.test.ts`, `menuService.test.ts`, `userService.test.ts`). Run with `npm test`.
