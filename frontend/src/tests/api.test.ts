import { describe, it, expect, beforeEach } from 'vitest'
import { AxiosHeaders } from 'axios'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// `handlers` is a real runtime array on axios's InterceptorManager, but not
// part of its public TS surface (only `use`/`eject`/`clear` are) — this
// typed accessor is the one place that reaches past the type to grab the
// function registered in services/api.ts, so we can invoke it directly
// against a fake config/error, without a real HTTP request or a mock server.
interface InterceptorHandler<TArg, TReturn> {
  fulfilled?: (arg: TArg) => TReturn
  rejected?: (error: unknown) => unknown
}

function firstHandler<TArg, TReturn>(manager: unknown): InterceptorHandler<TArg, TReturn> {
  const handlers = (manager as { handlers: InterceptorHandler<TArg, TReturn>[] }).handlers
  return handlers[0]
}

type FakeConfig = Record<string, unknown> & { headers: AxiosHeaders; method?: string }

const requestInterceptor = firstHandler<FakeConfig, FakeConfig>(api.interceptors.request).fulfilled!

function clearCookies() {
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

function makeConfig(method: string) {
  return { method, headers: new AxiosHeaders() }
}

describe('CSRF request interceptor (services/api.ts)', () => {
  beforeEach(() => {
    clearCookies()
  })

  it('attaches X-CSRF-Token from the csrf_token cookie on POST', () => {
    document.cookie = 'csrf_token=abc123'
    const config = requestInterceptor(makeConfig('post')) as { headers: AxiosHeaders }
    expect(config.headers.get('X-CSRF-Token')).toBe('abc123')
  })

  it.each(['put', 'patch', 'delete'])('attaches the header on %s too', (method) => {
    document.cookie = 'csrf_token=xyz789'
    const config = requestInterceptor(makeConfig(method)) as { headers: AxiosHeaders }
    expect(config.headers.get('X-CSRF-Token')).toBe('xyz789')
  })

  it('does NOT attach the header on GET (non-mutating)', () => {
    document.cookie = 'csrf_token=abc123'
    const config = requestInterceptor(makeConfig('get')) as { headers: AxiosHeaders }
    expect(config.headers.get('X-CSRF-Token')).toBeUndefined()
  })

  it('does nothing when the csrf_token cookie is absent', () => {
    const config = requestInterceptor(makeConfig('post')) as { headers: AxiosHeaders }
    expect(config.headers.get('X-CSRF-Token')).toBeUndefined()
  })

  it('reads the right cookie among several present', () => {
    document.cookie = 'other_cookie=irrelevant'
    document.cookie = 'csrf_token=the-real-token'
    const config = requestInterceptor(makeConfig('post')) as { headers: AxiosHeaders }
    expect(config.headers.get('X-CSRF-Token')).toBe('the-real-token')
  })
})

describe('401 response interceptor (services/api.ts)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle' })
  })

  it('clears the auth store when a request comes back 401', async () => {
    useAuthStore.getState().setUser({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: [],
      mustChangePassword: false,
    })

    const responseInterceptor = firstHandler<unknown, unknown>(api.interceptors.response).rejected!

    await expect(responseInterceptor({ response: { status: 401 } })).rejects.toBeDefined()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('leaves the auth store untouched on non-401 errors', async () => {
    useAuthStore.getState().setUser({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: [],
      mustChangePassword: false,
    })

    const responseInterceptor = firstHandler<unknown, unknown>(api.interceptors.response).rejected!

    await expect(responseInterceptor({ response: { status: 500 } })).rejects.toBeDefined()
    expect(useAuthStore.getState().status).toBe('authenticated')
  })
})
