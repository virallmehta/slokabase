const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

export const env = {
  apiUrl,
  // GET /api/menu is mounted unversioned on the backend (app.js), unlike
  // every other route which lives under /api/v1/* — derive its root from
  // apiUrl so there's still one source of truth for the backend's origin.
  apiRootUrl: apiUrl.replace(/\/api\/v\d+\/?$/, '/api'),
} as const
