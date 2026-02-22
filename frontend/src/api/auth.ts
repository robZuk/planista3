import client from './client'
import type { User } from '../types'

export interface LoginResponse {
  data: {
    accessToken: string
    refreshToken: string
    user: User
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    client.post<LoginResponse>('/auth/login', { email, password }),

  me: () => client.get<{ data: User }>('/auth/me'),

  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refreshToken }),
}
