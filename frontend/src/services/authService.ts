import { api } from '@/services/api'
import type { User } from '@/store/authStore'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  name: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
}

export const authService = {
  async login(payload: LoginPayload): Promise<User> {
    const { data } = await api.post<{ user: User }>('/auth/login', payload)
    return data.user
  },

  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await api.post<{ user: User }>('/auth/register', payload)
    return data.user
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<User> {
    const { data } = await api.get<{ user: User }>('/auth/me')
    return data.user
  },

  // Backend always returns the same generic { message } whether or not the
  // email is registered — nothing here to branch on, just fire and forget.
  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email })
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await api.post('/auth/reset-password', payload)
  },
}
