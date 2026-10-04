import { Navigate, Outlet } from 'react-router-dom'
import SessionGate from '../components/common/SessionGate'
import { useAuth } from '../hooks/useAuth'

export default function GuestRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <SessionGate />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
