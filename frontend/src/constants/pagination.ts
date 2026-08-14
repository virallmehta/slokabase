// A page size, or the sentinel meaning "show every row on one page" — see
// frontend/DESIGN.md's list-view checklist: every list page's "Rows per
// page" dropdown must offer exactly 25/50/100/All, in that order.
export type PageSize = number | 'all'

// Matches the backend's DEFAULT_PAGE_SIZE (backend/src/config/constants.js)
// — keep both in sync if either changes.
export const DEFAULT_PAGE_SIZE: PageSize = 25

export const PAGE_SIZE_OPTIONS: PageSize[] = [25, 50, 100, 'all']
