import axios from 'axios'
import { env } from '@/config/env'
import { useAuthStore } from '@/store/authStore'

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Single axios instance every service module imports — mirrors the
 * backend's "one db instance everything goes through" convention
 * (src/db/knex.js). `withCredentials: true` is required so the browser
 * sends/receives the httpOnly access/refresh cookies and the readable
 * csrf_token cookie cross-origin.
 */
export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

// Double-submit CSRF protection (mirrors backend/src/middleware/csrf.js):
// the server pairs an httpOnly session cookie with a second, readable
// csrf_token cookie. A forged cross-site request can't read that cookie,
// so echoing it back as a header on every mutating request proves the
// call actually came from this origin's JS.
api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method && MUTATING_METHODS.has(method)) {
    const csrfToken = readCookie('csrf_token')
    if (csrfToken) {
      config.headers.set('X-CSRF-Token', csrfToken)
    }
  }
  return config
})

// If a request comes back 401, the session cookie is gone/expired — keep
// the in-memory auth store from lying about who's logged in.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clear()
    }
    return Promise.reject(error)
  }
)
