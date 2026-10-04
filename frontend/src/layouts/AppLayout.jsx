import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import TopNav from '../components/layout/TopNav'
import { useAuth } from '../hooks/useAuth'

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <Sidebar
        open={menuOpen}
        showSettings={hasRole('SUPER_ADMIN')}
        onNavigate={() => setMenuOpen(false)}
      />
      {menuOpen ? (
        <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <div className="shell-main">
        <TopNav
          user={user}
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen((open) => !open)}
          onLogout={handleLogout}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
