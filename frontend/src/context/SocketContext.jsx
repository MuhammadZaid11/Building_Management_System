import { createContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  connect,
  disconnect,
  getSocketStatus,
  listen,
  onSocketRevision,
  onSocketStatus,
  subscribe,
} from '../services/socket.service'

export const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState(getSocketStatus)
  const [revision, setRevision] = useState(0)

  useEffect(() => onSocketStatus(setStatus), [])
  useEffect(() => onSocketRevision(() => setRevision((current) => current + 1)), [])

  useEffect(() => {
    if (user) connect()
    else disconnect()
    return undefined
  }, [user])

  const value = useMemo(() => ({
    status,
    revision,
    subscribe,
    listen,
  }), [status, revision])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
