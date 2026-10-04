import { createContext, useEffect, useMemo, useState } from 'react'
import { login as loginRequest, logout as logoutRequest, restoreSession } from '../services/auth.service'
import { onSessionCleared } from '../utils/session'
import { hasAnyRole, hasRole } from '../utils/roles'

const AuthContext = createContext(null)

let restorePromise = null

function loadSession() {
  if (!restorePromise) {
    restorePromise = restoreSession().finally(() => {
      restorePromise = null
    })
  }

  return restorePromise
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    loadSession()
      .then((sessionUser) => {
        if (!ignore) {
          setUser(sessionUser)
        }
      })
      .catch(() => {
        if (!ignore) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })

    const unsubscribe = onSessionCleared(() => {
      setUser(null)
    })

    return () => {
      ignore = true
      unsubscribe()
    }
  }, [])

  const value = useMemo(() => {
    return {
      user,
      isAuthenticated: Boolean(user),
      loading,
      hasRole: (role) => hasRole(user, role),
      hasAnyRole: (roles) => hasAnyRole(user, roles),
      async login(email, password) {
        const sessionUser = await loginRequest(email, password)
        setUser(sessionUser)
        return sessionUser
      },
      async logout() {
        try {
          await logoutRequest()
        } finally {
          setUser(null)
        }
      },
    }
  }, [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
