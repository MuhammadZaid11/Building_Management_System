import axios from 'axios'
import {
  getAccessToken,
  getRefreshToken,
  markSessionExpired,
  saveTokens,
} from '../utils/session'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

export const api = axios.create({ baseURL })

const refreshClient = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    throw new Error('No refresh token')
  }

  const response = await refreshClient.post('/auth/refresh', { refreshToken })
  const tokens = response.data?.data

  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Refresh failed')
  }

  saveTokens(tokens.accessToken, tokens.refreshToken)
  return tokens.accessToken
}

function isAuthEndpoint(url = '') {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    const status = error.response?.status

    if (status !== 401 || !config || config._retry || isAuthEndpoint(config.url)) {
      return Promise.reject(error)
    }

    config._retry = true

    try {
      refreshPromise = refreshPromise || refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const accessToken = await refreshPromise
      config.headers.Authorization = `Bearer ${accessToken}`
      return api(config)
    } catch (refreshError) {
      markSessionExpired()
      return Promise.reject(refreshError)
    }
  },
)

export async function getHealth() {
  const origin = baseURL.replace(/\/api\/v1\/?$/, '')
  const response = await axios.get(`${origin}/api/health`)
  return response.data?.data
}

