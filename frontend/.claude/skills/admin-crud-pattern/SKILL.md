---
name: admin-crud-pattern
description: Use when building or reviewing any admin list/detail page pair (a "module" page like Users, Roles, or a future Products/Sales frontend) — the established list-view and detail-view shape every admin section must match, plus a completion checklist to run before calling either view done.
---

# Admin CRUD pattern

Two reference implementations exist and must stay in sync with each other:

- **List + detail**: `src/pages/admin/UsersListPage.tsx` / `UserDetailPage.tsx` — the original.
- **List + detail**: `src/pages/admin/RolesListPage.tsx` / `RoleDetailPage.tsx` — the second, verified-against-this-checklist instance (added after the first Roles list shipped without several of these elements and had to be rebuilt).

`Products`/`Sales` currently have **no dedicated frontend pages** — the sidebar links to them via the dynamic `GET /api/menu`-driven catch-all (`PlaceholderPage`), per `backend/modules/products|sales`. If you build real pages for them, follow this same pattern.

## Why this exists

A Roles list view shipped with a bare `DataTable` and no search/filter/checkbox column/bulk actions/pagination — it looked like a list page but didn't behave like the other ones in the app. The gap wasn't caught until a follow-up review. **Check the list-view checklist below before considering any new or edited list view complete — not just the detail view.**

## List view checklist

Every admin list page needs all of these, not a subset:

- [ ] **Search input**, debounced via `useDebouncedValue` (`src/hooks/useDebouncedValue.ts`), resetting to page 1 on change.
- [ ] **At least one filter dropdown** (`Select`) for whatever categorical dimension the entity has (Users: role + status; Roles: system vs. custom). Also resets to page 1 on change.
- [ ] **Checkbox column**: header checkbox toggles all *selectable* rows on the current page; per-row checkbox toggles one. Disable/omit selection for rows a bulk action can't apply to (e.g. a system role can't be bulk-deleted, so its checkbox is disabled).
- [ ] **Bulk-action bar**: appears only when `selectedIds.size > 0`, shows a count, the relevant bulk action(s), and a "Clear" button.
- [ ] **`DataTable`** (`src/components/data-table/DataTable.tsx`) for the table itself — generic, not reimplemented per page.
- [ ] **`DataTablePagination`** (`src/components/data-table/DataTablePagination.tsx`) — numbered pages, not just next/previous, with a rows-per-page `Select`.
- [ ] Row click and a row-level "actions" `DropdownMenu` (View/Edit/Delete) both navigate to the detail route.
- [ ] Single-row delete and bulk delete each confirm via `AlertDialog` before calling the API, and surface failures (e.g. a 409 because the row is still referenced elsewhere) as an inline `Alert`, not a silent failure.
- [ ] A "New X" button in the page header.

**Backend-paginated vs. client-paginated**: Users' list is server-driven (`listUsers({ search, role, status, page, limit })` — the backend does the filtering because the table can be large). Roles' list has no such backend query support and the roles table is expected to stay small, so `RolesListPage` fetches the full list once and does search/filter/pagination client-side against it. Either is fine — pick server-side when the backend endpoint already supports it or the row count could realistically grow large; otherwise client-side against one fetch is simpler and still has to produce the same UI/interaction shape above.

## Detail view checklist

- [ ] Header row: "Back to X" ghost button above it; title (+ a status/type `Badge` if the entity has one) on the left; action buttons on the right — **Delete** (if the specific row is deletable) before **Save**.
- [ ] Delete condition must be a real guard, not just "button exists": e.g. `UserDetailPage` hides Delete for `currentUser.id === user.id`; `RoleDetailPage` hides it for system roles (`role.is_system`). Whatever the condition is, the **backend must enforce the same rule independently** — never rely on the frontend hiding a button as the only protection (see `backend/modules/roles/controller.js`'s `deleteRole`/`updateRole` guards).
- [ ] Save/error state as `Alert`s directly above the form: a destructive `Alert` for `saveError`/`deleteError`, a default `Alert` for a `saved` confirmation. Both `UserDetailPage` and `RoleDetailPage` use this exact pattern — don't substitute a toast library (none is installed; see `frontend/CLAUDE.md`).
- [ ] **A create flow needs the same confirmation a save does.** Don't let "New X" silently redirect with no acknowledgement — either show the same kind of saved `Alert` after redirecting into the new record's own detail page (`RoleDetailPage` does this via `navigate(path, { state: { justCreated: true } })`, consumed in a one-shot `useEffect` keyed on `location`), or redirect back to the list. Silence is not confirmation.
- [ ] Read-only fields (a value the user can see but not this page can't edit) use the `readOnly` HTML attribute, **not** `disabled`. `disabled` triggers `Input`'s built-in opacity/background fade (`disabled:opacity-50 disabled:bg-input/50`), which reads as low-contrast/broken rather than intentionally locked. `readOnly` keeps full border/background contrast while still blocking edits.
- [ ] Form via `react-hook-form` + `zodResolver`, schema in `src/validators/`, `Card` sections for each logical group of fields, `Label` + `Input`/`Select`/`Controller` per field with inline `errors.<field>.message` below it.

## Reference reading order

1. `UsersListPage.tsx` — the fullest example (search, role + status filters, bulk archive + CSV export, checkbox column, pagination).
2. `UserDetailPage.tsx` — form + right-rail metadata/activity cards + delete guard.
3. `RolesListPage.tsx` / `RoleDetailPage.tsx` — same shape applied to an entity with client-side (not backend-paginated) list data, a permission-grouped custom form section, and a create flow with its own success confirmation.
