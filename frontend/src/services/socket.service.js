import { io } from 'socket.io-client'
import { REALTIME_EVENTS } from '../constants/realtime'
import { refreshAccessToken } from './api'
import {
  getAccessToken,
  markSessionExpired,
  onTokensSaved,
} from '../utils/session'

const origin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

let socket = null
let status = 'disconnected'
let authRecoveryUsed = false
let slowTimer = null
let slowTries = 0
const SLOW_RETRIES = 4
const SLOW_RETRY_MS = 10000
const statusListeners = new Set()
const revisionListeners = new Set()
const handlers = new Set()
const rooms = new Map()

function setStatus(next) {
  if (status === next) return
  status = next
  statusListeners.forEach((listener) => listener(status))
}

function clearSlowRetry() {
  if (slowTimer) {
    clearTimeout(slowTimer)
    slowTimer = null
  }
}

function scheduleSlowRetry() {
  if (!socket || slowTries >= SLOW_RETRIES) {
    setStatus('disconnected')
    return
  }

  clearSlowRetry()
  setStatus('connecting')
  slowTimer = setTimeout(() => {
    slowTries += 1
    if (!socket) return
    setStatus('connecting')
    socket.connect()
  }, SLOW_RETRY_MS)
}

function desiredRooms() {
  return [...rooms.keys()]
}

function emitJoin() {
  const names = desiredRooms()
  if (socket?.connected && names.length > 0) {
    socket.emit('realtime:join', { rooms: names })
  }
}

function bindSocket(nextSocket) {
  handlers.forEach(({ event, handler }) => nextSocket.on(event, handler))

  nextSocket.on('connect', () => {
    authRecoveryUsed = false
    slowTries = 0
    clearSlowRetry()
    setStatus('connected')
    emitJoin()
  })

  nextSocket.on('disconnect', () => {
    setStatus(nextSocket.active ? 'connecting' : 'disconnected')
  })

  nextSocket.io.on('reconnect_attempt', () => setStatus('connecting'))
  nextSocket.io.on('reconnect_failed', () => scheduleSlowRetry())
  nextSocket.io.on('reconnect', () => {
    setStatus('connected')
    emitJoin()
    revisionListeners.forEach((listener) => listener())
  })

  nextSocket.on('connect_error', async (error) => {
    if (error?.message !== 'UNAUTHORIZED') {
      setStatus(nextSocket.active ? 'connecting' : 'disconnected')
      return
    }

    if (authRecoveryUsed) {
      markSessionExpired()
      disconnect()
      return
    }

    authRecoveryUsed = true

    try {
      const token = await refreshAccessToken()
      nextSocket.auth = { token }
      nextSocket.connect()
    } catch {
      markSessionExpired()
      disconnect()
    }
  })
}

export function getSocketStatus() {
  return status
}

export function onSocketStatus(listener) {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function onSocketRevision(listener) {
  revisionListeners.add(listener)
  return () => revisionListeners.delete(listener)
}

export function connect() {
  const token = getAccessToken()
  if (!token) return

  if (socket) {
    socket.auth = { token }
    if (!socket.connected) {
      setStatus('connecting')
      socket.connect()
    }
    return
  }

  socket = io(origin, {
    autoConnect: false,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    transports: ['websocket', 'polling'],
  })
  bindSocket(socket)
  setStatus('connecting')
  socket.connect()
}

export function disconnect() {
  if (socket) {
    socket.removeAllListeners()
    socket.io.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  handlers.clear()
  rooms.clear()
  authRecoveryUsed = false
  slowTries = 0
  clearSlowRetry()
  setStatus('disconnected')
}

export function subscribe(names) {
  const joined = []
  names.filter(Boolean).forEach((name) => {
    const next = (rooms.get(name) || 0) + 1
    rooms.set(name, next)
    if (next === 1) joined.push(name)
  })

  if (joined.length > 0 && socket?.connected) {
    socket.emit('realtime:join', { rooms: joined })
  }

  return () => unsubscribe(names)
}

export function unsubscribe(names) {
  const leaving = []
  names.filter(Boolean).forEach((name) => {
    const next = (rooms.get(name) || 0) - 1
    if (next <= 0) {
      rooms.delete(name)
      leaving.push(name)
    } else {
      rooms.set(name, next)
    }
  })

  if (leaving.length > 0 && socket?.connected) {
    socket.emit('realtime:leave', { rooms: leaving })
  }
}

export function listen(event, handler) {
  const entry = { event, handler }
  handlers.add(entry)
  socket?.on(event, handler)
  return () => {
    handlers.delete(entry)
    socket?.off(event, handler)
  }
}

export function removeListener(event, handler) {
  handlers.forEach((entry) => {
    if (entry.event === event && entry.handler === handler) handlers.delete(entry)
  })
  socket?.off(event, handler)
}

onTokensSaved((token) => {
  if (socket) socket.auth = { token }
})

export { REALTIME_EVENTS }
