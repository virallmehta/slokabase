/**
 * Plain, deploy-time-fixed constants — not database-backed settings (an
 * admin can't change these without a code change) and not environment
 * config (they don't vary per-deployment). See backend/CLAUDE.md's
 * "Hard config vs. soft setting vs. plain constant" section for the rule
 * that puts these here instead of app_settings or process.env.
 */

// Default page size for any paginated list endpoint that doesn't receive
// an explicit `limit` — matches the frontend's own default (see
// frontend/src/constants/pagination.ts's DEFAULT_PAGE_SIZE, which must
// stay in sync with this value).
export const DEFAULT_PAGE_SIZE = 25;

// Ceiling for any paginated list endpoint's `limit` — caps a single query
// while still comfortably covering the frontend's "All" rows-per-page
// option (see frontend/src/constants/pagination.ts's PAGE_SIZE_OPTIONS).
export const MAX_PAGE_SIZE = 500;
