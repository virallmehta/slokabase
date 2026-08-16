# DESIGN.md

**This file is the single source of truth for this app's visual/interaction design.** Check it before starting any UI work, and reference it directly (not from memory) when fixing a visual bug — cite the specific token/rule/checklist item involved. If a fix isn't traceable to something in this file, either the fix is wrong or this file is missing something and needs updating in the same change.

## Color & contrast tokens

Source of truth: `src/index.css`'s `:root` / `.dark` blocks (`--border`, `--input`, `--primary`, `--background`, ...). Everything below is the actual current value — not a target — plus the contrast math against the surface each one sits on.

| Token | CSS var | Light value (OKLCH) | Light ≈ hex | Dark value (OKLCH) |
|---|---|---|---|---|
| Input border color | `--input` (`border-input`) | `oklch(0.65 0 0)` | `#949494` | `oklch(1 0 0 / 15%)` |
| Input background color | none set in light mode — `Input` uses `bg-transparent`; only `dark:bg-input/30` is set | *(transparent — shows whatever's behind it, i.e. page/card white)* | — | `--input` at 30% alpha over `--background` |
| Checkbox border color (unchecked) | `--input` (`border-input`), same variable as the input border | `oklch(0.65 0 0)` | `#949494` | `oklch(1 0 0 / 15%)` |
| Checkbox checked-state color | `--primary` (`data-checked:bg-primary`, also used for `data-indeterminate:`) | `oklch(0.546 0.245 262.881)` | `#155dfb`-ish blue | `oklch(0.623 0.214 259.815)` |
| Page background color | `--background` | `oklch(1 0 0)` (pure white) | `oklch(0.145 0 0)` (near-black) |

**Minimum contrast requirement (explicit, not negotiable): WCAG 2.1 SC 1.4.11 (Non-text Contrast) — 3:1 minimum for UI component borders/states against the surface immediately behind them.** This applies to every input border, checkbox border, and checkbox checked-state fill in the app.

### Current contrast, computed

Using WCAG relative luminance (`(L+0.05)/(L+0.05)` ratio; for an achromatic OKLCH color, linear relative luminance `Y = L³`; `--primary` computed via full OKLab→linear-sRGB→Y since it has chroma):

| Pair | Ratio | Requirement | Status |
|---|---|---|---|
| Input/checkbox border (`#949494`, `--input: oklch(0.65 0 0)`) vs. page background (white) | **≈3.24:1** | 3:1 | Passes |
| Input/checkbox border, dark mode (`oklch(1 0 0 / 15%)` composited over `oklch(0.145 0 0)`) vs. that same dark background | ≈3.82:1 | 3:1 | Passes (already did — not changed) |
| Checkbox checked fill (`--primary`, blue) vs. page background (white) | ≈5.25:1 | 3:1 | Passes |

**Fixed**: `--input` was `oklch(0.922 0 0)` (~`#e5e5e5`, **1.26:1** — fails). Changed to `oklch(0.65 0 0)` (~`#949494`, **3.24:1** — passes) in `src/index.css`'s `:root` block. `--border` (Card/divider borders, a separate token that happened to share the old value) was deliberately left untouched — only `--input` (used by `Input`/`Checkbox` via `border-input`) was in scope. Dark mode's `--input` was already passing (≈3.82:1 composited) and was left as-is.

The hairline-border design intent (`CLAUDE.md`: "0.5px borders everywhere") and the color chosen for a token are two separate decisions — thinness is a design choice, contrast is a color-value decision. This fix changed **only the color value**, not the width.

### Every component currently using `Input` or `Checkbox` styling

One canonical style (`src/components/ui/input.tsx`, `src/components/ui/checkbox.tsx`) — check changes against all of these, not just the page you're editing:

**`Input`** (`border-input` + the contrast issue above applies to all of them):
- `src/pages/auth/Login.tsx` — email, password
- `src/pages/auth/Register.tsx` — name, email, password, confirm password
- `src/pages/ProfilePage.tsx` — name, email, password-change fields
- `src/pages/admin/CreateUserDialog.tsx` — name, email
- `src/pages/admin/UserDetailPage.tsx` — name, email
- `src/pages/admin/RoleDetailPage.tsx` — name, description (`readOnly`, not `disabled`, for system roles — see Detail view checklist)
- `src/pages/admin/UsersListPage.tsx` — search input
- `src/pages/admin/RolesListPage.tsx` — search input
- `src/pages/admin/AuditLogListPage.tsx` — search input, plus two `type="date"` inputs (date range filter)
- `src/pages/admin/SettingsPage.tsx` — one `Input` (`text` or `number`, by setting type) per string/number-typed setting, except sensitive keys (currently only `smtp_password`), which render `type="password"` with a "Leave blank to keep current value" placeholder instead — the backend never echoes that value back, so an empty field on load must not mean "clear it" (see `backend/CLAUDE.md`'s Email bullet); `type="json"` settings use a plain `<textarea>` instead (no dedicated `Textarea` component exists yet — see that page's comment)
- `src/pages/auth/ForgotPassword.tsx` — email
- `src/pages/auth/ResetPassword.tsx` — new password, confirm password
- `src/pages/ForcedPasswordChange.tsx` — temporary (current) password, new password, confirm password

**`Checkbox`**:
- `src/pages/admin/UsersListPage.tsx` — header select-all + per-row selection
- `src/pages/admin/RolesListPage.tsx` — header select-all + per-row selection
- `src/pages/admin/RoleDetailPage.tsx` — per-permission toggle (not a list-selection checkbox, but same component/tokens)
- `src/pages/admin/SettingsPage.tsx` — one per boolean-typed setting (not a list-selection checkbox, but same component/tokens)
- Audit Log has **no** `Checkbox` usage — see the list-view checklist's exception note below for why that's correct, not a gap.

Products and Sales have **no frontend pages at all** (backend modules only, sidebar links to a generic `PlaceholderPage` — see `frontend/CLAUDE.md`), so there is currently nothing to list for them here. The moment either gets a real page, its inputs/checkboxes belong in this inventory too.

## List-view component checklist

**Required on every list page — Products, Sales, Users, Roles, and any future module. No partial credit; a list view is not "done" until every row below is checked off.**

- [ ] Search input
- [ ] Filter dropdown(s)
- [ ] Checkbox column with correct select-all logic:
  - checked only when **all** rows selected
  - indeterminate when **some** rows selected
  - unchecked when **none** selected
  - (`src/utils/selectionState.ts`'s `getSelectAllState` is the canonical implementation — reuse it, don't hand-roll the tri-state comparison per page)
- [ ] Bulk-action bar — appears only when 1+ rows are selected, hidden otherwise
- [ ] Kebab (`⋯`) menu per row: **View / Edit / Delete**
- [ ] Pagination:
  - numbered pages (not just Previous/Next)
  - a "Rows per page" dropdown with **exactly** these options, **in this order**: `25, 50, 100, All` — this exact set, on every list view, no exceptions, no per-page substitutions

### Exception: read-only/immutable lists (checkbox column, bulk-action bar, and Edit/Delete)

`AuditLogListPage` has no checkbox column, no bulk-action bar, and its per-row action is a single "View details" button rather than a View/Edit/Delete kebab. This is a deliberate, confirmed exception, not an unaudited gap — reasoning:

- A checkbox column and bulk-action bar exist to enable a bulk **action** (archive, delete, ...). Audit log entries are an immutable system record — there is no create/edit/delete operation that could ever apply to one, individually or in bulk. A checkbox with nothing to enable is UI chrome with no function behind it.
- Same logic for the kebab menu: Edit and Delete don't apply to a log entry. Only "View" (the full before/after diff) is meaningful, so it's a single visible icon button, not a 3-dot menu hiding one item behind an extra click.

**This exception applies only to genuinely read-only/immutable list views** (nothing in the row is ever created, edited, or deleted through the UI). It does not apply to Products, Sales, Users, or Roles — those are all mutable entities and must have the full checklist above. If a future list view is read-only for the same reason (e.g. a metrics/report table), the same carve-out applies; state it explicitly in that page's code, the way `AuditLogListPage.tsx` does, rather than silently omitting the elements.

## Detail/edit-view checklist

- [ ] Back button (top-left, above the title row)
- [ ] Title + status badge (if the entity has a status/type concept — e.g. Users' active/suspended, Roles' System)
- [ ] Header button group: **Delete** (if this specific row is deletable — see the backend-enforced guard pattern in `frontend/.claude/skills/admin-crud-pattern/SKILL.md`) then **Save changes**, right-aligned
- [ ] Main form panel (Card, `react-hook-form` + `zodResolver`, `Label` + field + inline error per field)
- [ ] Right rail, where applicable to the entity:
  - Summary/Metadata card
  - Activity log card
  - Related records card

### Exception: single-form pages with no list behind them (Settings-shaped pages)

`SettingsPage` has no Back button, no status badge, no Delete, and no right rail — a deliberate, confirmed exception, same spirit as Audit Log's list-view exception above:

- **No Back button**: a Back button implies "you arrived here from a list of these." Settings isn't a record among many of its kind — it's a direct sidebar destination (same class of page as Profile), so there's no list to go back to.
- **No status badge**: badges communicate a per-record state (Users' active/suspended, Roles' System) — there is no analogous per-record state for a settings form.
- **No Delete**: nothing in a settings form is a deletable row; each field is a fixed key the seed defines, edited in place, never removed.
- **No right rail**: Metadata/Activity log/Related records all describe *a specific record's* history and relationships. A settings form isn't one record — each field already carries its own `updated_by`/`updated_at` (see `backend/src/services/settingsRepository.js`'s `app_settings` table), which is the per-field equivalent of a Metadata card, shown inline rather than in a separate rail.

**This exception applies only to pages that are a single configuration/preferences form with no enclosing list** — it does not relax the checklist for Users, Roles, or any entity a user creates multiple of. State the reasoning explicitly in that page's code (the way `SettingsPage.tsx` does) rather than silently omitting the elements.

## Auth pages and the full-screen gate pattern

`Login`, `Register`, `ForgotPassword`, `ResetPassword` (`src/pages/auth/`) all share one shape: a single `Card` (`max-w-sm`), vertically and horizontally centered in the viewport (`flex min-h-svh items-center justify-center p-4`), no sidebar, no topbar. A form field's error renders as `<p className="text-destructive text-sm">` directly beneath its `Input`, matching every other form in the app. A page-level API error or success/confirmation (e.g. "reset link sent", a failed login) is a `sonner` toast (`toast.error`/`toast.success`, fired in the submit handler's `catch`/`then`) — **not** an inline `Alert` — see the Toast vs. Alert convention below. The one exception on these pages is `ResetPassword.tsx`'s missing/invalid-token state, which is a genuine page-level Alert (it replaces the form entirely rather than reporting on an action taken on the page — see that convention section for why this one stays an `Alert`). Secondary navigation (`Back to sign in`, `Register`, `Forgot password?`) is `text-muted-foreground text-sm underline underline-offset-4` (destructive-styled links use `text-primary` instead — see `Login.tsx`'s `Register` link vs. its `Forgot password?` link), stacked in the `CardFooter`, never inline with a field label — `Forgot password?` briefly lived next to the Password field's `Label` and was moved down for exactly this reason.

`src/pages/ForcedPasswordChange.tsx` reuses this exact same Card shape even though it's an **authenticated** page (rendered by `ProtectedRoute`, not `GuestRoute`) — it's the one place in the app where an authenticated user sees no `DashboardLayout`/sidebar/topbar at all. This is deliberate: the whole point of the forced-password-change gate (see `frontend/CLAUDE.md`'s Routing/Auth notes) is that nothing else in the app is reachable until the password is changed, so rendering it inside the normal chrome — with a sidebar full of links to pages the user can't actually navigate to — would be misleading. Any future full-screen, no-chrome, authenticated gate page should follow this same pattern: the shared auth-page Card shape, not a stripped-down `DashboardLayout`.

**A one-time flash message across a redirect** (e.g. `ResetPassword.tsx` → `Login.tsx` after a successful reset, `RoleDetailPage.tsx`'s post-create redirect) is passed via React Router's `navigate(path, { state: { flash: '...' } })` / `{ state: { justCreated: true } }`, read on the receiving page with `useLocation()`, and fired as a `toast.success(...)` in a `useEffect` — see `Login.tsx`'s `flash` handling. That effect needs a `useRef` "already shown" guard, not just the location-state check: React 19's `<StrictMode>` (`main.tsx`) double-invokes effects once in development, which would otherwise show the same toast twice on every flash-redirect landing. The effect also replaces the location state (`navigate(location.pathname, { replace: true, state: {} })`) after showing the toast, so a later back-button visit to that history entry doesn't re-trigger it. It is not persisted beyond that (no query param, no store) — a hard refresh of the destination page discards it, which is correct for a one-time confirmation.

## Toast vs. Alert convention

Two different UI elements report two different kinds of thing — using the wrong one for either is a design bug, not just a style nitpick:

- **`sonner` toast** (`toast.success(...)` / `toast.error(...)`, `<Toaster />` mounted once in `src/App.tsx`) — the result of an **action the user just took**: a save, a create, a delete, a login attempt, a bulk operation, "send test email." Fired directly in the `try`/`catch` (or `.then()`/`.catch()`) at the point the action resolves. Transient, doesn't block or replace anything else on the page, and needs no local state to drive it — no `const [saved, setSaved] = useState(...)` pattern anymore.
- **Inline `Alert`** — a **page-level state**, not an action outcome: the page's own data failed to load, so there's nothing else to show in its place. Every current use is a `loadError`/list-`error` that gates the page's main content behind `if (loadError) return <Alert>...</Alert>` (or `error ? <Alert> : <normal content>`) — `RoleDetailPage`, `UserDetailPage`, `SettingsPage`, `UsersListPage`, `RolesListPage`, `AuditLogListPage` all follow this shape. `ResetPassword.tsx`'s missing/invalid-token Alert is the same category: it's true the instant the page loads (no action was taken to cause it), and it replaces the form rather than sitting above it.
- **Inline field error** (`<p className="text-destructive text-sm">` beneath an `Input`, from `react-hook-form`'s `errors.<field>.message`) — validation feedback for one specific field. Unaffected by either rule above; this was never an `Alert` and isn't becoming a toast either.

If you're adding a new mutating action (anything that calls a `service.*` write method), its success/failure feedback is a toast. If you're adding a page that can fail to load its own data, that failure is an `Alert` replacing the content. Don't reach for `Alert` for a create/update/delete result, and don't reach for a toast to explain why a page is empty.

## Verification rule

**Before marking any UI fix as complete, state the exact before/after values or logic being changed.** For a contrast/color fix: the before and after CSS custom property value (or computed border/background color) and the recomputed WCAG ratio. For a logic fix (e.g. the select-all tri-state bug): the before and after expression/condition, not just "fixed the checkbox." "Looks right" or "fixed" with no stated diff is not an acceptable completion report for a UI change.
