import { api } from './api'
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../utils/session'

export async function login(email, password) {
  const response = await api.post('/auth/login', { email, password })
  const session = response.data.data
  saveTokens(session.accessToken, session.refreshToken)
  return session.user
}

export async function logout() {
  const refreshToken = getRefreshToken()

  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken })
    }
  } finally {
    clearTokens()
  }
}

export async function restoreSession() {
  if (!getAccessToken() && !getRefreshToken()) {
    return null
  }

  const response = await api.get('/auth/me')
  return response.data.data.user
}
