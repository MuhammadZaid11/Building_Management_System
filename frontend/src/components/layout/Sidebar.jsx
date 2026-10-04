import { NavLink, useLocation } from 'react-router-dom'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/buildings', label: 'Buildings' },
  { to: '/devices', label: 'Devices' },
  { to: '/sensors', label: 'Sensors' },
  { to: '/alarms', label: 'Alarms' },
  { to: '/energy', label: 'Energy' },
]

export default function Sidebar({ open, showSettings, onNavigate }) {
  const location = useLocation()
  const infrastructure = /^\/(buildings|floors|zones|rooms)(\/|$)/.test(location.pathname)

  return (
    <aside id="app-sidebar" className={open ? 'sidebar sidebar-open' : 'sidebar'}>
      <p className="brand">BMS</p>
      <nav aria-label="Primary">
        <ul>
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to !== '/buildings'}
                onClick={onNavigate}
                aria-current={link.to === '/buildings' && infrastructure ? 'page' : undefined}
                className={({ isActive }) => (isActive || (link.to === '/buildings' && infrastructure) ? 'nav-active' : undefined)}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
          {showSettings ? (
            <li>
              <NavLink to="/settings" onClick={onNavigate}>
                Settings
              </NavLink>
            </li>
          ) : null}
        </ul>
      </nav>
    </aside>
  )
}
