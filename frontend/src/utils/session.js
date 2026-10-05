const ACCESS_KEY = 'bms.accessToken'
const REFRESH_KEY = 'bms.refreshToken'

const listeners = new Set()
const tokenListeners = new Set()
let sessionExpired = false

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_KEY) || ''
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY) || ''
}

export function saveTokens(accessToken, refreshToken) {
  sessionStorage.setItem(ACCESS_KEY, accessToken)
  sessionStorage.setItem(REFRESH_KEY, refreshToken)
  tokenListeners.forEach((listener) => listener(accessToken))
}

export function onTokensSaved(listener) {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
}

export function markSessionExpired() {
  sessionExpired = true
  clearTokens()
  listeners.forEach((listener) => listener())
}

export function peekSessionExpired() {
  return sessionExpired
}

export function clearSessionNotice() {
  sessionExpired = false
}

export function onSessionCleared(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
